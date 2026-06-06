import { createFileRoute } from "@tanstack/react-router";
import { requireServerUser } from "@/server/functions/auth";
import {
  ActiveRunExistsError,
  classifyUpdatePrompt,
  createBuilderRunHandle,
  newRunId,
  publishBuilderRunEvent,
  runInitBuilderRun,
  runNewRouteBuilderRun,
  runSmallUpdateBuilderRun,
} from "@/features/agents/codex/runtime";
import { getCodexEnv, isCodexFeatureAvailable } from "@/features/agents/codex/runtime/feature-flag.server";
import type { BuilderRunKind } from "@/features/agents/ui/builder-run-status";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute(
  // @ts-ignore API routes are runtime-only and omitted from routeTree.gen.ts.
  "/api/projects/$projectId/builder-runs/$runId/retry",
)({
  server: {
    handlers: {
      POST: async ({ params, request }) => {
        const user = await requireServerUser();
        const { projectId } = params as { projectId: string };
        if (!isCodexFeatureAvailable()) {
          return jsonResponse(503, {
            ok: false,
            code: "config_unavailable",
            message: "AI builder is unavailable. Try again later.",
          });
        }
        const env = getCodexEnv();
        if (!env.available) {
          return jsonResponse(503, {
            ok: false,
            code: "config_unavailable",
            message: "AI builder is unavailable. Try again later.",
          });
        }
        const body = (await request.json().catch(() => ({}))) as {
          prompt?: string;
          kind?: BuilderRunKind;
          locale?: string;
        };
        const prompt = body.prompt?.trim();
        if (!prompt) {
          return jsonResponse(400, {
            ok: false,
            code: "blocked_request",
            message: "Prompt is required.",
          });
        }
        let resolvedKind: BuilderRunKind;
        if (body.kind === "init") resolvedKind = "init";
        else if (body.kind === "new_route") resolvedKind = "new_route";
        else if (body.kind === "update") resolvedKind = "update";
        else {
          const classification = classifyUpdatePrompt({ prompt, fileManifest: [] });
          if (classification.kind === "unsupported") {
            return jsonResponse(400, {
              ok: false,
              code: "blocked_request",
              message: "Yêu cầu nằm ngoài phạm vi cho phép.",
            });
          }
          resolvedKind = classification.kind === "new_route" ? "new_route" : "update";
        }

        const newId = newRunId();
        let handle;
        try {
          handle = createBuilderRunHandle({
            runId: newId,
            projectId,
            userId: user.id,
          });
        } catch (error) {
          if (error instanceof ActiveRunExistsError) {
            return jsonResponse(409, {
              ok: false,
              code: "active_run_exists",
              message:
                "Project đang có một phiên builder đang chạy. Hãy đợi hoặc huỷ phiên hiện tại trước khi thử lại.",
            });
          }
          throw error;
        }

        const runCtx = {
          projectId,
          userId: user.id,
          runId: newId,
          kind: resolvedKind,
          userPrompt: prompt,
          locale: body.locale ?? "vi-VN",
          env,
          projectSummary: null,
          signal: handle.abortController.signal,
        };

        const driver =
          resolvedKind === "init"
            ? runInitBuilderRun
            : resolvedKind === "new_route"
              ? runNewRouteBuilderRun
              : runSmallUpdateBuilderRun;

        void driver(runCtx, (event) => publishBuilderRunEvent(handle, event)).catch(
          (error) => {
            publishBuilderRunEvent(handle, {
              type: "failed",
              runId: newId,
              milestone: "failed",
              failureCode: "codex_runtime_failed",
              message: error instanceof Error ? error.message : "unexpected error",
              at: Date.now(),
            });
          },
        );

        return jsonResponse(201, { ok: true, runId: newId });
      },
    },
  },
});
