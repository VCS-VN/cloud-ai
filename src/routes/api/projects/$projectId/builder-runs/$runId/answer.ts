import { createFileRoute } from "@tanstack/react-router";
import { requireServerUser } from "@/server/functions/auth";
import { getBuilderRunHandle } from "@/features/agents/codex/runtime/builder-run-registry.server";
import { BUILDER_RUN_LOCALE_EN } from "@/features/agents/ui/builder-run-i18n";
import { getProjectServices } from "@/server/services/project-services";
import { publishChatEvent } from "@/server/services/chat-event-channel.server";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute(
  // @ts-ignore API routes are runtime-only and omitted from routeTree.gen.ts.
  "/api/projects/$projectId/builder-runs/$runId/answer",
)({
  server: {
    handlers: {
      POST: async ({ params, request }) => {
        const user = await requireServerUser();
        const { runId } = params as unknown as { runId: string };

        const handle = getBuilderRunHandle(runId);
        if (!handle) {
          return jsonResponse(404, {
            ok: false,
            code: "not_found",
            message: "Run not found.",
          });
        }
        if (handle.userId && handle.userId !== user.id) {
          return jsonResponse(403, {
            ok: false,
            code: "forbidden",
            message: "You do not have access to this run.",
          });
        }
        if (handle.status !== "awaiting_clarification") {
          return jsonResponse(409, {
            ok: false,
            code: "RUN_NOT_AWAITING_INPUT",
            message: BUILDER_RUN_LOCALE_EN.apiErrors.not_paused,
          });
        }

        const body = (await request.json().catch(() => ({}))) as {
          optionId?: unknown;
          freeText?: unknown;
          planAction?: unknown;
        };
        const optionId =
          typeof body.optionId === "string" ? body.optionId.trim() : "";
        const freeText =
          typeof body.freeText === "string" ? body.freeText.trim() : "";
        const planAction =
          body.planAction === "approve" || body.planAction === "reject"
            ? (body.planAction as "approve" | "reject")
            : "";

        if (!optionId && !freeText && !planAction) {
          return jsonResponse(400, {
            ok: false,
            code: "empty_answer",
            message: BUILDER_RUN_LOCALE_EN.apiErrors.empty_answer,
          });
        }

        if (planAction) {
          // planAction is only valid when the run is paused on plan_review.
          // The runtime persists this on agent_runs.plan_phase.stage = "plan_ready".
          const services = await getProjectServices();
          const run = await services.chatHistoryService.runStore
            .load(runId, user.id)
            .catch(() => undefined);
          const planStage = run?.planPhase?.stage;
          if (planStage !== "plan_ready") {
            return jsonResponse(409, {
              ok: false,
              code: "RUN_NOT_AWAITING_INPUT",
              message: BUILDER_RUN_LOCALE_EN.apiErrors.not_paused,
            });
          }
        }

        if (optionId) {
          const options = handle.clarificationPrompt?.options ?? [];
          const matched = options.some((option) => option.id === optionId);
          if (!matched) {
            return jsonResponse(400, {
              ok: false,
              code: "INVALID_OPTION",
              message: BUILDER_RUN_LOCALE_EN.apiErrors.invalid_option,
            });
          }
        }

        const resumeFn = handle.resumeFn;
        if (!resumeFn) {
          return jsonResponse(500, {
            ok: false,
            code: "detector_failed",
            message: "Could not resume the run.",
          });
        }

        const answer: { optionId?: string; freeText?: string; planAction?: "approve" | "reject" } = {};
        if (optionId) answer.optionId = optionId;
        if (freeText) answer.freeText = freeText;
        if (planAction) answer.planAction = planAction;

        try {
          await resumeFn(answer);
        } catch {
          return jsonResponse(500, {
            ok: false,
            code: "detector_failed",
            message: "Could not resume the run.",
          });
        }

        // Publish option.selected so SSE replay (after reconnect / tab refocus)
        // restores the picker's committed state. Without this, the channel
        // buffer only contains the original `message.created` agent_question
        // and replay resurrects the unanswered version.
        if (optionId || freeText) {
          publishChatEvent(runId, {
            type: "option.selected",
            runId,
            messageId: `msg-${runId}-question`,
            optionId: optionId || `__custom:${freeText}`,
          });
        }

        return new Response(null, { status: 204 });
      },
    },
  },
});
