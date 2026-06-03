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
  "/api/projects/$projectId/runs/$runId/select-option",
)({
  server: {
    handlers: {
      POST: async ({ params, request }) => {
        const user = await requireServerUser();
        const { projectId, runId } = params as { projectId: string; runId: string };
        const body = (await request.json()) as { optionId?: string };

        if (!body.optionId) {
          return errorResponse(400, "INVALID_OPTION", "optionId is required.");
        }

        const { messageService } = await getProjectServices();
        try {
          const result = await messageService.selectOption(
            projectId,
            runId,
            body.optionId,
            user.id,
          );
          return new Response(JSON.stringify(result), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Could not select option.";
          const code = (error as { code?: StreamErrorCode }).code;
          if (code === "RUN_NOT_FOUND" || code === "RUN_NOT_AWAITING_INPUT") {
            return errorResponse(code === "RUN_NOT_FOUND" ? 404 : 409, code, message);
          }
          if (code === "INVALID_OPTION") {
            return errorResponse(400, "INVALID_OPTION", message);
          }
          if (code === "OPTION_ALREADY_SELECTED") {
            return errorResponse(409, "OPTION_ALREADY_SELECTED", message);
          }
          return errorResponse(500, "PROVIDER_STREAM_FAILED", message);
        }
      },
    },
  },
});
