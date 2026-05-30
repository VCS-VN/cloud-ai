import { createFileRoute } from "@tanstack/react-router";
import { getProjectServices } from "@/server/services/project-services";
import { requireServerUser } from "@/server/functions/auth";
import type { StreamErrorCode } from "@/shared/project-types";

function errorResponse(status: number, code: StreamErrorCode, message: string) {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute(
  // @ts-ignore API routes are runtime-only and omitted from routeTree.gen.ts.
  "/api/projects/$projectId/runs/$runId/stop",
)({
  server: {
    handlers: {
      POST: async ({ params }) => {
        const user = await requireServerUser();
        const { projectId, runId } = params as { projectId: string; runId: string };
        const { messageService } = await getProjectServices();
        try {
          const result = await messageService.stopRun(projectId, runId, user.id);
          return new Response(JSON.stringify(result), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Could not stop run.";
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
