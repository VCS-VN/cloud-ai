import { createFileRoute } from "@tanstack/react-router";
import { getProjectServices } from "@/server/services/project-services";
import {
  createMessageStreamHeaders,
  encodeRunStreamEvent,
  subscribeRun,
  disposeRunHubIfDone,
  RUN_HEARTBEAT_MS,
} from "@/server/functions/project-message-stream";
import { requireServerUser } from "@/server/functions/auth";
import type { RunStreamEvent } from "@/shared/project-types";

const TERMINAL_TYPES = new Set(["run.completed", "run.failed", "run.stopped"]);

export const Route = createFileRoute(
  // @ts-ignore API routes are runtime-only and omitted from routeTree.gen.ts.
  "/api/projects/$projectId/runs/$runId/stream",
)({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const user = await requireServerUser();
        const { projectId, runId } = params as { projectId: string; runId: string };
        const { messageService } = await getProjectServices();

        let streamClosed = false;
        let heartbeat: ReturnType<typeof setInterval> | undefined;
        let unsubscribe: (() => void) | undefined;

        const stream = new ReadableStream<Uint8Array>({
          async start(streamController) {
            const close = () => {
              if (streamClosed) return;
              streamClosed = true;
              if (heartbeat) clearInterval(heartbeat);
              unsubscribe?.();
              try {
                streamController.close();
              } catch {
                // already closed
              }
              disposeRunHubIfDone(projectId, runId);
            };

            const onEvent = (event: RunStreamEvent) => {
              if (streamClosed) return;
              try {
                streamController.enqueue(encodeRunStreamEvent(event));
              } catch {
                close();
                return;
              }
              // Close once the run reaches a terminal event — works for both the
              // producer and any extra subscribers (tabs) sharing the fan-out.
              if (TERMINAL_TYPES.has(event.type)) close();
            };

            // Subscribe first so buffered events replay, then kick off the run.
            // driveRun claims the producer slot and drives the orchestrator;
            // extra subscribers no-op there and stay open until the terminal
            // event arrives via fan-out.
            unsubscribe = subscribeRun(projectId, runId, onEvent);

            heartbeat = setInterval(() => {
              onEvent({ type: "heartbeat", runId });
            }, RUN_HEARTBEAT_MS);

            void messageService.driveRun(projectId, runId, user.id).catch((error) => {
              onEvent({
                type: "run.failed",
                runId,
                projectProcessingStatus: "idle",
                error: {
                  code: "PROVIDER_STREAM_FAILED",
                  message: error instanceof Error ? error.message : "Stream failed.",
                },
              });
            });
          },
          cancel() {
            streamClosed = true;
            if (heartbeat) clearInterval(heartbeat);
            unsubscribe?.();
            disposeRunHubIfDone(projectId, runId);
          },
        });

        return new Response(stream, { headers: createMessageStreamHeaders() });
      },
    },
  },
});
