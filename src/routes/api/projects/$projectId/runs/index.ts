import { createFileRoute } from "@tanstack/react-router";
import { getProjectServices } from "@/server/services/project-services";
import { requireServerUser } from "@/server/functions/auth";
import type { ComposerReasoningEffort, StreamErrorCode } from "@/shared/project-types";

function errorResponse(status: number, code: StreamErrorCode, message: string) {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute(
  // @ts-ignore API routes are runtime-only and omitted from routeTree.gen.ts.
  "/api/projects/$projectId/runs/",
)({
  server: {
    handlers: {
      POST: async ({ params, request }) => {
        const user = await requireServerUser();
        const { projectId } = params as { projectId: string };
        const body = (await request.json().catch(() => ({}))) as {
          content?: string;
          reasoningEffort?: ComposerReasoningEffort;
          planMode?: boolean;
        };

        if (!body.content || !body.content.trim()) {
          return errorResponse(400, "PROMPT_EMPTY", "Message cannot be empty.");
        }

        const { messageService } = await getProjectServices();
        try {
          const result = await messageService.createRun(
            projectId,
            body.content,
            { reasoningEffort: body.reasoningEffort, planMode: body.planMode },
            user.id,
          );
          return new Response(JSON.stringify(result), {
            status: 201,
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Could not create run.";
          if (message.includes("already generating")) {
            return errorResponse(409, "PROJECT_ALREADY_PROCESSING", message);
          }
          if (message.includes("not found")) {
            return errorResponse(404, "PROJECT_NOT_FOUND", message);
          }
          return errorResponse(500, "PROVIDER_STREAM_FAILED", message);
        }
      },
    },
  },
});
