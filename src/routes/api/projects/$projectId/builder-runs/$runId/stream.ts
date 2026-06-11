import { createFileRoute } from "@tanstack/react-router";
import { requireServerUser } from "@/server/functions/auth";
import { getBuilderRunHandle } from "@/features/agents/codex/runtime";
import {
  subscribeChatEvents,
  getChatChannelStatus,
} from "@/server/services/chat-event-channel.server";
import { getProjectServices } from "@/server/services/project-services";
import type { RunStreamEvent } from "@/shared/project-types";

function formatSse(event: RunStreamEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

function isTerminal(event: RunStreamEvent): boolean {
  return (
    event.type === "run.completed" ||
    event.type === "run.failed" ||
    event.type === "run.stopped"
  );
}

export const Route = createFileRoute(
  // @ts-ignore API routes are runtime-only and omitted from routeTree.gen.ts.
  "/api/projects/$projectId/builder-runs/$runId/stream",
)({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const user = await requireServerUser();
        const { runId } = params as unknown as { runId: string };

        const handle = getBuilderRunHandle(runId);
        if (handle && handle.userId && handle.userId !== user.id) {
          return new Response(
            JSON.stringify({ ok: false, code: "forbidden", message: "forbidden" }),
            { status: 403, headers: { "Content-Type": "application/json" } },
          );
        }

        // Phase 5 SSE: chat channel is the source of truth for translated
        // RunStreamEvents. If the channel exists (live or just-terminated), the
        // SSE consumer subscribes to it. If neither channel nor handle exists,
        // fall back to a one-shot replay synthesized from agent_runs persisted
        // state (post-restart / archived run).
        const channelStatus = getChatChannelStatus(runId);
        if (channelStatus.exists) {
          return new Response(openChannelStream(runId), {
            headers: {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache, no-transform",
              Connection: "keep-alive",
            },
          });
        }

        const services = await getProjectServices();
        const run = await services.chatHistoryService.runStore
          .load(runId, user.id)
          .catch(() => undefined);
        if (!run) {
          return new Response(
            JSON.stringify({ ok: false, code: "not_found", message: "run not found" }),
            { status: 404, headers: { "Content-Type": "application/json" } },
          );
        }
        return new Response(buildArchivedReplay(runId, run), {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
          },
        });
      },
    },
  },
});

function openChannelStream(runId: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const send = (event: RunStreamEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(formatSse(event)));
        } catch {
          closed = true;
          return;
        }
        if (isTerminal(event)) {
          closed = true;
          subscription.unsubscribe();
          try {
            controller.close();
          } catch {
            // already closed
          }
        }
      };
      const subscription = subscribeChatEvents(runId, send);
      // If the channel was already terminal at subscribe time, every buffered
      // event has been delivered; close the stream now.
      if (subscription.terminal) {
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
    cancel() {
      // listener unsubscribes itself on terminal event; nothing to do here
    },
  });
}

export type RunForReplay = {
  status: string;
  failureCode?: string;
  progressTimeline?: Array<
    | { at: number; kind: "milestone"; milestone: string }
    | { at: number; kind: "section"; section: string; locale: string }
    | { at: number; kind: "summary"; text: string }
    | { at: number; kind: "error"; failureCode: string }
    | {
        at: number;
        kind: "task_plan";
        tasks: Array<{ id: string; title: string; phase: "prep" | "build" | "verify" }>;
      }
    | {
        at: number;
        kind: "task_transition";
        id: string;
        transition: "started" | "completed" | "paused" | "resumed";
      }
  >;
};

export function buildArchivedReplay(runId: string, run: RunForReplay): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      const enqueue = (event: RunStreamEvent) => {
        try {
          controller.enqueue(encoder.encode(formatSse(event)));
        } catch {
          // closed
        }
      };
      const projectId = (run as { projectId?: string }).projectId ?? "";
      enqueue({ type: "run.started", runId, projectId });
      const timeline = run.progressTimeline ?? [];
      const lastSummary = timeline.findLast((item) => item.kind === "summary");
      for (const item of timeline) {
        if (item.kind === "task_plan") {
          enqueue({
            type: "plan.created",
            runId,
            tasks: item.tasks,
            at: item.at,
          });
        } else if (item.kind === "task_transition") {
          const eventType =
            item.transition === "started"
              ? "plan.task.started"
              : item.transition === "completed"
                ? "plan.task.completed"
                : item.transition === "paused"
                  ? "plan.task.paused"
                  : "plan.task.resumed";
          enqueue({
            type: eventType,
            runId,
            taskId: item.id,
            at: item.at,
          });
        }
        // milestone/section/error/summary are decorative for archived runs; the
        // status terminal below is what the UI cares about.
      }
      if (lastSummary) {
        const messageId = `msg-${runId}-answer`;
        enqueue({
          type: "message.created",
          runId,
          messageId,
          kind: "answer",
          content: lastSummary.text,
          processingStatus: "completed",
          createdAt: new Date(lastSummary.at).toISOString(),
          metadata: null,
        });
        enqueue({
          type: "message.completed",
          runId,
          messageId,
          content: lastSummary.text,
        });
      }
      if (run.status === "completed") {
        enqueue({ type: "run.completed", runId, projectProcessingStatus: "idle" });
      } else if (run.status === "failed" || run.status === "interrupted") {
        enqueue({
          type: "run.failed",
          runId,
          projectProcessingStatus: "idle",
          error: {
            code: "PROVIDER_STREAM_FAILED",
            message:
              run.status === "interrupted"
                ? "Phiên xử lý bị gián đoạn. Bạn có thể thử lại an toàn."
                : "Đã xảy ra lỗi.",
          },
        });
      } else if (run.status === "stopped") {
        enqueue({ type: "run.stopped", runId, projectProcessingStatus: "idle" });
      }
      try {
        controller.close();
      } catch {
        // already closed
      }
    },
  });
}
