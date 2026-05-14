import { createFileRoute } from "@tanstack/react-router";
import { getProjectServices } from "@/server/services/project-services";
import {
  createMessageStreamHeaders,
  encodeMessageStreamEvent,
  registerProjectMessageStream,
  releaseProjectMessageStream,
  toStreamFailureEvent,
} from "@/server/functions/project-message-stream";
import { requireServerUser } from "@/server/functions/auth";
import type { MessageStreamEvent } from "@/shared/project-types";

export const Route = createFileRoute(
  "/api/projects/$projectId/messages/$agentMessageId/stream",
)({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const user = await requireServerUser();
        const { projectId, agentMessageId } = params as { projectId: string; agentMessageId: string };

        const { messageService } = await getProjectServices();

        const abortController = new AbortController();
        registerProjectMessageStream(projectId, agentMessageId, abortController);

        let streamClosed = false;
        let heartbeat: ReturnType<typeof setInterval> | undefined;

        const stream = new ReadableStream<Uint8Array>({
          async start(streamController) {
            const safeEnqueue = (event: MessageStreamEvent) => {
              if (streamClosed || abortController.signal.aborted) return false;
              try {
                streamController.enqueue(encodeMessageStreamEvent(event));
                return true;
              } catch (error) {
                streamClosed = true;
                if (heartbeat) clearInterval(heartbeat);
                console.info(
                  JSON.stringify({
                    event: "message_stream_enqueue_failed",
                    projectId,
                    messageId: agentMessageId,
                    reason: error instanceof Error ? error.message : "Stream controller closed.",
                  }),
                );
                return false;
              }
            };

            heartbeat = setInterval(() => {
              safeEnqueue({
                type: "heartbeat",
                messageId: agentMessageId,
              });
            }, 15000);

            try {
              await messageService.streamProjectMessage(
                projectId,
                agentMessageId,
                async (event) => {
                  safeEnqueue(event);
                },
                abortController.signal,
                undefined,
                user.id,
              );
            } catch (error) {
              safeEnqueue(
                toStreamFailureEvent({
                  messageId: agentMessageId,
                  code: "PROVIDER_STREAM_FAILED",
                  message:
                    error instanceof Error ? error.message : "Stream failed.",
                }),
              );
            } finally {
              if (heartbeat) clearInterval(heartbeat);
              releaseProjectMessageStream(projectId, agentMessageId, abortController);
              if (!streamClosed) {
                streamClosed = true;
                streamController.close();
              }
            }
          },
          cancel(reason) {
            streamClosed = true;
            if (heartbeat) clearInterval(heartbeat);
            abortController.abort(reason);
            releaseProjectMessageStream(projectId, agentMessageId, abortController);
          },
        });

        return new Response(stream, {
          headers: createMessageStreamHeaders(),
        });
      },
    },
  },
});
