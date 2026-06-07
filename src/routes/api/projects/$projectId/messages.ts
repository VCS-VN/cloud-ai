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
  "/api/projects/$projectId/messages",
)({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const user = await requireServerUser();
        const { projectId } = params as { projectId: string };
        const url = new URL(request.url);
        const beforeCreatedAt = url.searchParams.get("beforeCreatedAt") ?? undefined;
        const beforeId = url.searchParams.get("beforeId") ?? undefined;
        const limitRaw = url.searchParams.get("limit");
        const limit = limitRaw ? Math.min(Math.max(Number(limitRaw), 1), 100) : 50;

        const services = await getProjectServices();
        try {
          const page = await services.chatHistoryService.getProjectMessages(
            projectId,
            user.id,
            { beforeCreatedAt, beforeId, limit },
          );
          return jsonResponse(200, { ok: true, ...page });
        } catch (error) {
          if (error instanceof Error && error.message === "Project not found.") {
            return jsonResponse(404, {
              ok: false,
              code: "PROJECT_NOT_FOUND",
              message: "Project not found.",
            });
          }
          return jsonResponse(500, {
            ok: false,
            code: "internal_error",
            message: "Could not load messages.",
          });
        }
      },
    },
  },
});
