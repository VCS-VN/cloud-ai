import { createFileRoute } from "@tanstack/react-router";
import { requireServerUser } from "@/server/functions/auth";
import { getAuthService } from "@/auth/auth-service";
import { getProjectServices } from "@/server/services/project-services";
import { startBuilderRunForChat } from "@/server/services/builder-run-dispatcher.server";

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
        const { projectId, runId } = params as {
          projectId: string;
          runId: string;
        };

        const services = await getProjectServices();
        const projectRepository = services.projectService["projectRepository"];
        const messageRepository = services.projectService["messageRepository"];
        const runStore = services.chatHistoryService.runStore;

        const project = await projectRepository
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
        // key, so without it there is nothing to run.
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

        // Retry replays the original run's prompt. The client sends no body —
        // load the failed/stopped run to recover its prompt + reasoning effort.
        const previous = await runStore.load(runId, user.id).catch(() => undefined);
        if (!previous) {
          return jsonResponse(404, {
            ok: false,
            code: "RUN_NOT_FOUND",
            message: "The run to retry no longer exists.",
          });
        }
        const prompt = previous.userPrompt?.trim();
        if (!prompt) {
          return jsonResponse(400, {
            ok: false,
            code: "blocked_request",
            message: "The original run has no prompt to retry.",
          });
        }

        // Persist a fresh user Message + agent_runs row (linked to the prior
        // run via retryOfRunId) BEFORE dispatch so chat history survives a
        // crash mid-dispatch — same ordering as the POST start route.
        const now = new Date().toISOString();
        const userMessage = await messageRepository.saveMessage(
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
        const run = await runStore.create({
          projectId,
          userId: user.id,
          parentMessageId: userMessage.id,
          retryOfRunId: runId,
          userPrompt: prompt,
          reasoningEffort: previous.reasoningEffort,
          planMode: previous.planMode ?? false,
          model: previous.model,
          status: "streaming",
        });
        const updatedProject = await projectRepository.updateProjectProcessingState(
          projectId,
          "processing",
          user.id,
          run.id,
          now,
        );

        // Dispatch through startBuilderRunForChat so the chat-event-channel
        // bridge is set up — this is what publishes translated RunStreamEvents
        // to the SSE channel the client subscribes to. Calling the driver
        // directly (the old behavior) left the new runId with no channel, so
        // every live event was lost and the SSE endpoint fell back to an empty
        // archived replay.
        const dispatch = await startBuilderRunForChat({
          projectId,
          userId: user.id,
          prompt,
          reasoningEffort: previous.reasoningEffort ?? undefined,
          planMode: previous.planMode ?? false,
          model: previous.model,
          project: { status: project.status, languageContext: project.languageContext },
          runId: run.id,
          parentMessageId: userMessage.id,
          persistence: {
            messageRepository,
            projectRepository,
            runStore,
            agentRunRepository: services.projectService["agentRunRepository"],
          },
        });

        if (!dispatch.ok) {
          const httpStatus =
            dispatch.code === "config_unavailable"
              ? 503
              : dispatch.code === "episcloud_not_activated"
                ? 403
                : dispatch.code === "active_run_exists"
                  ? 409
                  : 400;
          return jsonResponse(httpStatus, {
            ok: false,
            code: dispatch.code,
            message: dispatch.message,
          });
        }

        return jsonResponse(201, {
          ok: true,
          runId: run.id,
          userMessage,
          project: {
            id: projectId,
            processingStatus: updatedProject?.processingStatus ?? "processing",
            activeRunId: run.id,
          },
          stream: {
            url: `/api/projects/${projectId}/builder-runs/${run.id}/stream`,
          },
        });
      },
    },
  },
});
