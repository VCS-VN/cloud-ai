import { createFileRoute } from "@tanstack/react-router";
import { requireServerUser } from "@/server/functions/auth";
import {
  getBuilderRunHandle,
  type BuilderRunHandle,
} from "@/features/agents/codex/runtime";
import type { BuilderRunEvent } from "@/features/agents/ui/builder-events";

function isTerminal(event: BuilderRunEvent): boolean {
  return event.type === "done" || event.type === "failed" || event.type === "cancelled";
}

function formatSse(event: BuilderRunEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

export const Route = createFileRoute(
  // @ts-ignore API routes are runtime-only and omitted from routeTree.gen.ts.
  "/api/projects/$projectId/builder-runs/$runId/stream",
)({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const user = await requireServerUser();
        const { runId } = params as { runId: string };
        const handle = getBuilderRunHandle(runId);
        if (!handle) {
          return new Response(
            JSON.stringify({ ok: false, code: "not_found", message: "run not found" }),
            { status: 404, headers: { "Content-Type": "application/json" } },
          );
        }
        if (handle.userId && handle.userId !== user.id) {
          return new Response(
            JSON.stringify({ ok: false, code: "forbidden", message: "forbidden" }),
            { status: 403, headers: { "Content-Type": "application/json" } },
          );
        }
        const stream = openSseStream(handle);
        return new Response(stream, {
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

function openSseStream(handle: BuilderRunHandle): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: BuilderRunEvent) => {
        try {
          controller.enqueue(encoder.encode(formatSse(event)));
        } catch {
          // controller already closed
        }
        if (isTerminal(event)) {
          handle.subscribers.delete(send);
          try {
            controller.close();
          } catch {
            // already closed
          }
        }
      };
      for (const buffered of handle.events) {
        send(buffered);
        if (isTerminal(buffered)) return;
      }
      handle.subscribers.add(send);
    },
    cancel() {
      // listener cleanup handled in send()
    },
  });
}
