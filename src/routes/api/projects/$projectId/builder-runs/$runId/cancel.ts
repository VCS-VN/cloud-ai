import { createFileRoute } from "@tanstack/react-router";
import { requireServerUser } from "@/server/functions/auth";
import { cancelBuilderRun } from "@/features/agents/codex/runtime";
import { stopPersistedRunIfActive } from "@/server/services/cancel-run-reconciliation.server";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute(
  // @ts-ignore API routes are runtime-only and omitted from routeTree.gen.ts.
  "/api/projects/$projectId/builder-runs/$runId/cancel",
)({
  server: {
    handlers: {
      POST: async ({ params }) => {
        const user = await requireServerUser();
        const { projectId, runId } = params as unknown as { projectId: string; runId: string };
        const result = cancelBuilderRun({ runId, userId: user.id });
        const reconciled = await stopPersistedRunIfActive(projectId, runId, user.id);
        if (!result.ok) {
          if (result.reason === "not_found" && reconciled) {
            return jsonResponse(200, { ok: true, recoveredPersistedRun: true });
          }
          if (result.reason === "not_found") {
            return jsonResponse(404, { ok: false, code: "not_found", message: "Run not found." });
          }
          if (result.reason === "forbidden") {
            return jsonResponse(403, { ok: false, code: "forbidden", message: "Forbidden." });
          }
          return jsonResponse(409, {
            ok: false,
            code: "already_terminal",
            message: "Run already finished.",
          });
        }
        return jsonResponse(200, {
          ok: true,
          alreadyCancelled: result.alreadyCancelled === true,
          reconciledPersistedRun: reconciled,
        });
      },
    },
  },
});
