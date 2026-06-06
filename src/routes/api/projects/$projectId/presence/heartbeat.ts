import { createFileRoute } from "@tanstack/react-router";
import { requireServerUser } from "@/server/functions/auth";
import { presenceService } from "@/features/runtime/legacy/presence-service.server";

const HEARTBEAT_INTERVAL_MS = 30_000;

export const Route = createFileRoute(
  // @ts-ignore API routes are runtime-only and omitted from routeTree.gen.ts.
  "/api/projects/$projectId/presence/heartbeat",
)({
  server: {
    handlers: {
      POST: async ({ params, request }) => {
        const user = await requireServerUser();
        const { projectId } = params;

        let body: { presenceId?: string };
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid request body" }, { status: 400 });
        }

        const { presenceId } = body;
        if (!presenceId) {
          return Response.json({ error: "presenceId is required" }, { status: 400 });
        }

        presenceService.processHeartbeat(projectId, user.id, presenceId);

        return Response.json({
          success: true,
          nextHeartbeatMs: HEARTBEAT_INTERVAL_MS,
        });
      },
    },
  },
});
