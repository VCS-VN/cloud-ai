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
  "/api/projects/$projectId/builder-runs/",
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
        const requestedKind = body.kind;
        let resolvedKind: BuilderRunKind;
        if (requestedKind === "init") {
          resolvedKind = "init";
        } else if (requestedKind === "new_route") {
          resolvedKind = "new_route";
        } else if (requestedKind === "update") {
          resolvedKind = "update";
        } else {
          const classification = classifyUpdatePrompt({ prompt, fileManifest: [] });
          if (classification.kind === "unsupported") {
            return jsonResponse(400, {
              ok: false,
              code: "blocked_request",
              message:
                classification.reason === "mentions_blocked_path"
                  ? "Yêu cầu chạm vào tệp được bảo vệ. Hãy thử yêu cầu UI/nội dung trong phạm vi cho phép."
                  : "Yêu cầu này nằm ngoài phạm vi small-update của phase 1.",
            });
          }
          resolvedKind = classification.kind === "new_route" ? "new_route" : "update";
        }
        const runId = newRunId();
        let handle;
        try {
          handle = createBuilderRunHandle({ runId, projectId, userId: user.id });
        } catch (error) {
          if (error instanceof ActiveRunExistsError) {
            return jsonResponse(409, {
              ok: false,
              code: "active_run_exists",
              message: "This project already has an active builder run.",
            });
          }
          throw error;
        }

        const runCtx = {
          projectId,
          userId: user.id,
          runId,
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
            : resolvedKind === "update"
              ? runSmallUpdateBuilderRun
              : resolvedKind === "new_route"
                ? runNewRouteBuilderRun
                : null;

        if (!driver) {
          publishBuilderRunEvent(handle, {
            type: "failed",
            runId,
            milestone: "failed",
            failureCode: "blocked_request",
            message: `kind ${resolvedKind} not implemented yet`,
            at: Date.now(),
          });
          return jsonResponse(201, { ok: true, runId });
        }

        void driver(runCtx, (event) => publishBuilderRunEvent(handle, event)).catch(
          (error) => {
            publishBuilderRunEvent(handle, {
              type: "failed",
              runId,
              milestone: "failed",
              failureCode: "codex_runtime_failed",
              message:
                error instanceof Error ? error.message : "unexpected error",
              at: Date.now(),
            });
          },
        );

        return jsonResponse(201, { ok: true, runId });
      },
    },
  },
});
