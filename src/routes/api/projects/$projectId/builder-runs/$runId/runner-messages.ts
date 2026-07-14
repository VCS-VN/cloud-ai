import { createFileRoute } from "@tanstack/react-router";
import { requireServerUser } from "@/server/functions/auth";
import { getProjectServices } from "@/server/services/project-services";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute(
  // @ts-ignore API routes are runtime-only and omitted from routeTree.gen.ts.
  "/api/projects/$projectId/builder-runs/$runId/runner-messages",
)({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const user = await requireServerUser();
        const { projectId, runId } = params as unknown as {
          projectId: string;
          runId: string;
        };

        const services = await getProjectServices();
        // Gate on project ownership — runner_messages are scoped by runId only
        // (no userId column), so the project ownership check is the access
        // boundary before returning a run's inner steps.
        const project = await services.projectRepository.getProject(
          projectId,
          user.id,
        );
        if (!project) {
          return jsonResponse(404, {
            ok: false,
            code: "PROJECT_NOT_FOUND",
            message: "Project not found.",
          });
        }

        const messages =
          await services.runnerMessageRepository.listRunnerMessagesByRunId(
            runId,
          );
        return jsonResponse(200, { ok: true, messages });
      },
    },
  },
});
