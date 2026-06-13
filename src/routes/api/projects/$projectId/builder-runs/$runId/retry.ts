import { createFileRoute } from "@tanstack/react-router";
import { requireServerUser } from "@/server/functions/auth";
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

        // The retry client may send an optional JSON body with a locale hint.
        // When absent (or when parsing fails), default to "en" so the task list
        // and fallback messages are not stuck in Vietnamese.
        let retryLocale = "en";
        try {
          const body = await request.json().catch(() => null);
          if (body && typeof body.locale === "string") {
            retryLocale = body.locale;
          }
        } catch {
          // Body may not be JSON or may be empty — keep the default.
        }

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
          locale: retryLocale,
          reasoningEffort: previous.reasoningEffort ?? undefined,
          planMode: previous.planMode ?? false,
          project: { status: project.status },
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
