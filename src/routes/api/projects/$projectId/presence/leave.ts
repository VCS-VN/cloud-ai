import { createFileRoute } from "@tanstack/react-router";
import { requireServerUser } from "@/server/functions/auth";
import { presenceService, type PresenceLeaveReason } from "@/features/ai-agent/runtime/presence-service.server";

const LEAVE_REASONS = new Set<PresenceLeaveReason>([
  "leave",
  "blur",
  "hidden",
  "unload",
  "expired",
]);

export const Route = createFileRoute(
  "/api/projects/$projectId/presence/leave",
)({
  server: {
    handlers: {
      POST: async ({ params, request }) => {
        await requireServerUser();
        const { projectId } = params;

        let body: { presenceId?: string; reason?: string };
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid request body" }, { status: 400 });
        }

        const { presenceId } = body;
        if (!presenceId) {
          return Response.json({ error: "presenceId is required" }, { status: 400 });
        }

        const reason = LEAVE_REASONS.has(body.reason as PresenceLeaveReason)
          ? (body.reason as PresenceLeaveReason)
          : "leave";
        presenceService.leavePresence(projectId, presenceId, reason);
        const activePresenceCount = presenceService.getActivePresenceCount(projectId);

        return Response.json({
          success: true,
          activePresenceCount,
          shutdownScheduled: activePresenceCount === 0,
        });
      },
    },
  },
});
