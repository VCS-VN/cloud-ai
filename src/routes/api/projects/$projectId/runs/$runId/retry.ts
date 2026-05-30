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
  "/api/projects/$projectId/runs/$runId/retry",
)({
  server: {
    handlers: {
      POST: async ({ params, request }) => {
        const user = await requireServerUser();
        const { projectId, runId } = params as { projectId: string; runId: string };
        const body = (await request.json().catch(() => ({}))) as {
          reasoningEffort?: ComposerReasoningEffort;
          planMode?: boolean;
        };
        const { messageService } = await getProjectServices();
        try {
          const result = await messageService.retryRun(
            projectId,
            runId,
            { reasoningEffort: body.reasoningEffort, planMode: body.planMode },
            user.id,
          );
          return new Response(JSON.stringify(result), {
            status: 201,
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Could not retry run.";
          if (message.includes("Only failed runs")) {
            return errorResponse(409, "RETRY_NOT_ALLOWED", message);
          }
          if (message.includes("already generating")) {
            return errorResponse(409, "PROJECT_ALREADY_PROCESSING", message);
          }
          if (message.includes("Run not found")) {
            return errorResponse(404, "RUN_NOT_FOUND", message);
          }
          if (message.includes("Project not found")) {
            return errorResponse(404, "PROJECT_NOT_FOUND", message);
          }
          return errorResponse(500, "PROVIDER_STREAM_FAILED", message);
        }
      },
    },
  },
});
