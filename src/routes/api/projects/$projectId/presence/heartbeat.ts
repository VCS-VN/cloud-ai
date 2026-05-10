import { createFileRoute } from "@tanstack/react-router";
import { requireServerUser } from "@/server/functions/auth";
import { presenceService } from "@/features/ai-agent/runtime/presence-service.server";

const HEARTBEAT_INTERVAL_MS = 30_000;

export const Route = createFileRoute(
  "/api/projects/$projectId/presence/heartbeat",
)({
  server: {
    handlers: {
      POST: async ({ params, request }) => {
        const user = await requireServerUser();
        const { projectId } = params;

        let body: { userId?: string };
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid request body" }, { status: 400 });
        }

        const { userId } = body;
        if (!userId) {
          return Response.json({ error: "userId is required" }, { status: 400 });
        }

        const processed = presenceService.processHeartbeat(projectId, userId);
        if (!processed) {
          presenceService.registerUser(projectId, userId);
        }

        return Response.json({
          success: true,
          nextHeartbeatMs: HEARTBEAT_INTERVAL_MS,
        });
      },
    },
  },
});