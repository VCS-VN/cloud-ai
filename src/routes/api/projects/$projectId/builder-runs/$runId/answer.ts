import { createFileRoute } from "@tanstack/react-router";
import { requireServerUser } from "@/server/functions/auth";
import { getBuilderRunHandle } from "@/features/agents/codex/runtime/builder-run-registry.server";
import { BUILDER_RUN_LOCALE_VI } from "@/features/agents/ui/builder-run-i18n";

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
        const { runId } = params as { runId: string };

        const handle = getBuilderRunHandle(runId);
        if (!handle) {
          return jsonResponse(404, {
            ok: false,
            code: "not_found",
            message: "Phiên không tìm thấy.",
          });
        }
        if (handle.userId && handle.userId !== user.id) {
          return jsonResponse(403, {
            ok: false,
            code: "forbidden",
            message: "Không có quyền truy cập phiên này.",
          });
        }
        if (handle.status !== "awaiting_clarification") {
          return jsonResponse(409, {
            ok: false,
            code: "not_paused",
            message: BUILDER_RUN_LOCALE_VI.apiErrors.not_paused,
          });
        }

        const body = (await request.json().catch(() => ({}))) as {
          optionId?: unknown;
          freeText?: unknown;
        };
        const optionId =
          typeof body.optionId === "string" ? body.optionId.trim() : "";
        const freeText =
          typeof body.freeText === "string" ? body.freeText.trim() : "";

        if (!optionId && !freeText) {
          return jsonResponse(400, {
            ok: false,
            code: "empty_answer",
            message: BUILDER_RUN_LOCALE_VI.apiErrors.empty_answer,
          });
        }

        if (optionId) {
          const options = handle.clarificationPrompt?.options ?? [];
          const matched = options.some((option) => option.id === optionId);
          if (!matched) {
            return jsonResponse(400, {
              ok: false,
              code: "invalid_option",
              message: BUILDER_RUN_LOCALE_VI.apiErrors.invalid_option,
            });
          }
        }

        const resumeFn = handle.resumeFn;
        if (!resumeFn) {
          return jsonResponse(500, {
            ok: false,
            code: "detector_failed",
            message: "Không thể tiếp tục phiên.",
          });
        }

        const answer: { optionId?: string; freeText?: string } = {};
        if (optionId) answer.optionId = optionId;
        if (freeText) answer.freeText = freeText;

        try {
          await resumeFn(answer);
        } catch {
          return jsonResponse(500, {
            ok: false,
            code: "detector_failed",
            message: "Không thể tiếp tục phiên.",
          });
        }

        return jsonResponse(200, { ok: true });
      },
    },
  },
});
