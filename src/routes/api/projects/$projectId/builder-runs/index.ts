import { createFileRoute } from "@tanstack/react-router";
import { requireServerUser } from "@/server/functions/auth";
import { getProjectServices } from "@/server/services/project-services";
import { startBuilderRunForChat } from "@/server/services/builder-run-dispatcher.server";
import { getAuthService } from "@/auth/auth-service";
import type { ComposerReasoningEffort } from "@/shared/project-types";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const VALID_REASONING_EFFORTS: ComposerReasoningEffort[] = ["low", "medium", "high", "xhigh"];

function parseReasoningEffort(value: unknown): ComposerReasoningEffort | undefined {
  if (typeof value !== "string") return undefined;
  return VALID_REASONING_EFFORTS.includes(value as ComposerReasoningEffort)
    ? (value as ComposerReasoningEffort)
    : undefined;
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

        const body = (await request.json().catch(() => ({}))) as {
          prompt?: unknown;
          reasoningEffort?: unknown;
          model?: unknown;
          planMode?: unknown;
          locale?: unknown;
          // kind is intentionally NOT accepted from clients (R5).
        };

        const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
        if (!prompt) {
          return jsonResponse(400, {
            ok: false,
            code: "blocked_request",
            message: "Prompt is required.",
          });
        }

        const reasoningEffort = parseReasoningEffort(body.reasoningEffort);
        // Model ids are dynamic (fetched per-user from Epis Cloud), so no enum
        // check — just trim and forward.
        const model =
          typeof body.model === "string" && body.model.trim()
            ? body.model.trim()
            : undefined;
        const planMode = body.planMode === true;

        const services = await getProjectServices();
        const project = await services.projectService["projectRepository"]
          .getProject(projectId, user.id)
          .catch(() => undefined);
        if (!project) {
          return jsonResponse(404, {
            ok: false,
            code: "PROJECT_NOT_FOUND",
            message: "Project not found.",
          });
        }
        if (project.processingStatus === "processing") {
          return jsonResponse(409, {
            ok: false,
            code: "active_run_exists",
            message: "This project already has an active builder run.",
          });
        }

        // Block BEFORE persisting anything when the user hasn't activated Epis
        // Cloud — the codex build authenticates against the user's Epis Cloud
        // key, so without it there is nothing to run. Checking here (not just
        // inside the dispatcher) avoids leaving a message + run row + project
        // "processing" state stranded.
        const episCloudApiKey = await getAuthService().getEpisCloudApiKeyForUserId(
          user.id,
        );
        if (!episCloudApiKey) {
          return jsonResponse(403, {
            ok: false,
            code: "episcloud_not_activated",
            message: "Activate EpisCloud to run AI builds on your account.",
          });
        }

        // Persist user Message + agent_runs row BEFORE kicking off the codex driver
        // so chat history survives a crash mid-dispatch (Phase 2 spec).
        const now = new Date().toISOString();
        const messageRepo = services.projectService["messageRepository"];
        const userMessage = await messageRepo.saveMessage(
          {
            id: crypto.randomUUID(),
            userId: user.id,
            projectId,
            role: "user",
            content: prompt,
            status: "completed",
            processingStatus: "completed",
            createdAt: now,
            updatedAt: now,
          },
          user.id,
        );
        const run = await services.chatHistoryService.runStore.create({
          projectId,
          userId: user.id,
          parentMessageId: userMessage.id,
          userPrompt: prompt,
          reasoningEffort,
          model,
          planMode,
          status: "streaming",
        });
        const updatedProject = await services.projectService["projectRepository"]
          .updateProjectProcessingState(projectId, "processing", user.id, run.id, now);
        const created = {
          runId: run.id,
          userMessage,
          project: {
            id: projectId,
            processingStatus: updatedProject?.processingStatus ?? "processing",
            activeRunId: run.id,
          },
        };

        const dispatch = await startBuilderRunForChat({
          projectId,
          userId: user.id,
          prompt,
          reasoningEffort,
          model,
          planMode,
          project: { status: project.status, languageContext: project.languageContext },
          runId: created.runId,
          parentMessageId: userMessage.id,
          persistence: {
            messageRepository: services.projectService["messageRepository"],
            projectRepository: services.projectService["projectRepository"],
            runStore: services.chatHistoryService.runStore,
            agentRunRepository: services.projectService["agentRunRepository"],
          },
        });

        if (!dispatch.ok) {
          const httpStatus =
            dispatch.code === "config_unavailable"
              ? 503
              : dispatch.code === "active_run_exists"
                ? 409
                : dispatch.code === "episcloud_not_activated"
                  ? 403
                  : 400;
          return jsonResponse(httpStatus, {
            ok: false,
            code: dispatch.code,
            message: dispatch.message,
          });
        }

        return jsonResponse(201, {
          ok: true,
          runId: created.runId,
          userMessage: created.userMessage,
          project: created.project,
          stream: {
            url: `/api/projects/${projectId}/builder-runs/${created.runId}/stream`,
          },
        });
      },
    },
  },
});
