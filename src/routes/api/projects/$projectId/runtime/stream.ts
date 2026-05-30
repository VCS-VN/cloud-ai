import { createFileRoute } from "@tanstack/react-router";
import {
  createMessageStreamHeaders,
  encodeRunStreamEvent,
  subscribeRuntime,
  RUN_HEARTBEAT_MS,
} from "@/server/functions/project-message-stream";
import { requireServerUser } from "@/server/functions/auth";
import type { RuntimeStreamEvent } from "@/shared/project-types";

export const Route = createFileRoute(
  // @ts-ignore API routes are runtime-only and omitted from routeTree.gen.ts.
  "/api/projects/$projectId/runtime/stream",
)({
  server: {
    handlers: {
      GET: async ({ params }) => {
        await requireServerUser();
        const { projectId } = params as { projectId: string };

        let streamClosed = false;
        let heartbeat: ReturnType<typeof setInterval> | undefined;
        let unsubscribe: (() => void) | undefined;

        const stream = new ReadableStream<Uint8Array>({
          start(streamController) {
            const safeEnqueue = (event: RuntimeStreamEvent) => {
              if (streamClosed) return;
              try {
                streamController.enqueue(encodeRunStreamEvent(event));
              } catch {
                streamClosed = true;
                if (heartbeat) clearInterval(heartbeat);
                unsubscribe?.();
              }
            };

            unsubscribe = subscribeRuntime(projectId, safeEnqueue);

            heartbeat = setInterval(() => {
              safeEnqueue({ type: "heartbeat" });
            }, RUN_HEARTBEAT_MS);
          },
          cancel() {
            streamClosed = true;
            if (heartbeat) clearInterval(heartbeat);
            unsubscribe?.();
          },
        });

        return new Response(stream, { headers: createMessageStreamHeaders() });
      },
    },
  },
});
