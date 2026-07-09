import { createFileRoute } from "@tanstack/react-router";
import { requireServerUser } from "@/server/functions/auth";
import { getBuilderRunHandle } from "@/features/agents/codex/runtime";
import {
  subscribeChatEvents,
  getChatChannelStatus,
} from "@/server/services/chat-event-channel.server";
import { getProjectServices } from "@/server/services/project-services";
import type { RunStreamEvent } from "@/shared/project-types";

// Keep the SSE connection warm. The client arms a 30s idle timeout that resets
// only on real events (use-chat-stream.ts); a quiet codex phase (large batch
// build, typecheck/build inside the repair loop) can exceed that and make the
// client synthesize a false run.failed while the run is still healthy. A
// sub-30s heartbeat keeps the idle timer from ever firing on a live run.
const HEARTBEAT_INTERVAL_MS = 15_000;

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
        const { projectId, runId } = params as unknown as {
          projectId: string;
          runId: string;
        };

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
        await reconcileArchivedReplayProjectState({
          projectRepository: services.projectRepository,
          projectId,
          runId,
          userId: user.id,
          runStatus: run.status,
        });
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

export async function reconcileArchivedReplayProjectState(input: {
  projectRepository: {
    updateProjectProcessingState: (
      projectId: string,
      processingStatus: "idle",
      userId?: string,
    ) => Promise<unknown>;
  };
  projectId: string;
  runId: string;
  userId?: string;
  runStatus: string;
}): Promise<void> {
  if (
    ![
      "completed",
      "failed",
      "stopped",
      "interrupted",
      "streaming",
      "awaiting_input",
    ].includes(input.runStatus)
  ) {
    return;
  }
  try {
    const project = await input.projectRepository.updateProjectProcessingState(
      input.projectId,
      "idle",
      input.userId,
    );
    if (!project) {
      console.warn(
        JSON.stringify({
          event: "archived_run_project_idle_update_missed",
          projectId: input.projectId,
          runId: input.runId,
          runStatus: input.runStatus,
        }),
      );
    }
  } catch (error) {
    console.warn(
      JSON.stringify({
        event: "archived_run_project_idle_update_failed",
        projectId: input.projectId,
        runId: input.runId,
        runStatus: input.runStatus,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}

function openChannelStream(runId: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  // Hoisted so cancel() (client disconnect) can trigger the same teardown the
  // start() closure uses on a terminal event / enqueue failure.
  let cleanup: () => void = () => undefined;
  return new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let heartbeat: ReturnType<typeof setInterval> | null = null;
      // Unsubscribe is routed through a holder rather than referencing the
      // `subscription` const directly: subscribeChatEvents() replays buffered
      // events synchronously, so a buffered terminal event runs send()->cleanup()
      // while `subscription` is still in its temporal dead zone. The holder is a
      // safe no-op during replay and is swapped for the real unsubscribe once
      // the subscribe call returns.
      let unsubscribe: () => void = () => undefined;
      // Single teardown path: stop the heartbeat, drop the channel listener so
      // it doesn't leak in channel.subscribers, and close the controller once.
      // Reused by the terminal-event branch, the enqueue-failure branch, and
      // cancel(). Idempotent via the `closed` guard.
      cleanup = () => {
        if (closed) return;
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        heartbeat = null;
        unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed
        }
      };
      const send = (event: RunStreamEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(formatSse(event)));
        } catch {
          // Enqueue throws when the client has disconnected — tear down fully
          // so the channel listener and heartbeat don't leak.
          cleanup();
          return;
        }
        if (isTerminal(event)) cleanup();
      };
      const subscription = subscribeChatEvents(runId, send);
      unsubscribe = subscription.unsubscribe;
      // If the channel was already terminal at subscribe time, every buffered
      // event has been delivered (and a terminal one may have already called
      // cleanup during replay); close the stream now if it hasn't been.
      if (subscription.terminal) {
        cleanup();
        return;
      }
      heartbeat = setInterval(() => send({ type: "heartbeat", runId }), HEARTBEAT_INTERVAL_MS);
      if (typeof heartbeat.unref === "function") heartbeat.unref();
    },
    cancel() {
      // Client disconnected before a terminal event. Without this the channel
      // listener leaks in channel.subscribers (non-terminal channels never get
      // an evictAt, so the sweep never reclaims them).
      cleanup();
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
        kind: "todo_snapshot";
        items: Array<{ id: string; text: string; completed: boolean }>;
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
        if (item.kind === "todo_snapshot") {
          enqueue({
            type: "plan.todo_updated",
            runId,
            items: item.items,
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
      } else if (run.status === "stopped") {
        enqueue({ type: "run.stopped", runId, projectProcessingStatus: "idle" });
      } else {
        // Everything else terminates as a failure. `failed` is an explicit
        // failure; `streaming`/`awaiting_input` reach this replay path ONLY
        // because the in-memory channel and run handle are gone (server
        // restart) — the run can never resume, so it must emit a terminal or
        // the client reconnect-loops and the project stays `processing`
        // forever. We frame these as interrupted (safe to retry) rather than a
        // hard error.
        const interrupted = run.status !== "failed";
        enqueue({
          type: "run.failed",
          runId,
          projectProcessingStatus: "idle",
          error: {
            code: "PROVIDER_STREAM_FAILED",
            message: interrupted
              ? "Phiên xử lý bị gián đoạn. Bạn có thể thử lại an toàn."
              : "Đã xảy ra lỗi.",
          },
        });
      }
      try {
        controller.close();
      } catch {
        // already closed
      }
    },
  });
}
