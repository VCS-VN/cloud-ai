import {
  AIProviderConfigurationError,
} from "@/ai/ai-provider";
import type { AgentOrchestrator } from "@/features/ai-agent/agent/agent-orchestrator.server";
import type { AgentStreamEvent } from "@/features/ai-agent/agent/agent-events";
import type { ProjectRunStore } from "@/features/ai-agent/project/project-run-store.server";
import type { DevRuntimeEvent } from "@/features/ai-agent/runtime/runtime-events";
import { sanitizeForUser } from "@/features/ai-agent/agent/user-facing-presenter";
import { createSkeletonMapper } from "@/features/ai-agent/agent/agent-event-to-skeleton";
import { decideMilestone } from "@/features/ai-agent/agent/agent-event-to-milestone";
import type {
  AgentMessageKind,
  ComposerReasoningEffort,
  Message,
  MessageCursor,
  MessagePage,
  RunCreatedState,
  RunStreamEvent,
} from "@/shared/project-types";
import type {
  ProjectMessageRepository,
  ProjectRepository,
} from "@/shared/project-types";
import {
  abortRun,
  claimRunProducer,
  consumeRunReservation,
  getProjectRunStreamUrl,
  getRunAbortSignal,
  publishRunEvent,
  publishRuntimeEvent,
  reserveRunProducer,
} from "@/server/functions/project-message-stream";

const COMPLETED_FALLBACK_CONTENT = "Done. Your storefront is ready.";
const FAILED_FALLBACK_CONTENT = "Something went wrong. You can retry safely.";

type CreateRunOptions = {
  reasoningEffort?: ComposerReasoningEffort;
  planMode?: boolean;
};

function assertMessageContent(content: string) {
  const trimmed = content.trim();
  if (!trimmed) throw new Error("Message cannot be empty.");
  return trimmed;
}

function isDevRuntimeEvent(event: AgentStreamEvent): event is DevRuntimeEvent {
  return event.type.startsWith("dev_");
}

export class MessageService {
  constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly messageRepository: ProjectMessageRepository,
    private readonly agentOrchestrator: AgentOrchestrator,
    private readonly runStore: ProjectRunStore,
  ) {}

  async getProjectMessages(
    projectId: string,
    userId?: string,
    cursor?: MessageCursor,
  ): Promise<MessagePage> {
    const project = await this.projectRepository.getProject(projectId, userId);
    if (!project) throw new Error("Project not found.");
    return this.messageRepository.listMessages(
      projectId,
      userId,
      normalizeCursor(cursor),
    );
  }

  /**
   * Creates a run synchronously: persists the user message, creates the
   * agent_runs row (status=streaming), flips the project to processing, and
   * reserves the producer slot. The orchestrator loop is NOT started here — it
   * begins when a client connects to the run stream (connect-time kick-off).
   */
  async createRun(
    projectId: string,
    content: string,
    options: CreateRunOptions = {},
    userId?: string,
  ): Promise<RunCreatedState> {
    const project = await this.projectRepository.getProject(projectId, userId);
    if (!project) throw new Error("Project not found.");
    if (project.processingStatus === "processing") {
      throw new Error("This project is already generating a response.");
    }

    const now = new Date().toISOString();
    const userMessage = await this.messageRepository.saveMessage(
      {
        id: crypto.randomUUID(),
        userId,
        projectId,
        role: "user",
        content: assertMessageContent(content),
        status: "completed",
        processingStatus: "completed",
        createdAt: now,
        updatedAt: now,
      },
      userId,
    );

    const run = await this.runStore.create({
      projectId,
      userId,
      parentMessageId: userMessage.id,
      userPrompt: userMessage.content,
      reasoningEffort: options.reasoningEffort,
      planMode: options.planMode ?? false,
      status: "streaming",
    });

    const nextProject = await this.projectRepository.updateProjectProcessingState(
      projectId,
      "processing",
      userId,
      run.id,
      now,
    );
    if (!nextProject) throw new Error("Project not found.");

    reserveRunProducer(projectId, run.id);

    return {
      runId: run.id,
      userMessage,
      project: {
        id: nextProject.id,
        processingStatus: nextProject.processingStatus,
        activeRunId: nextProject.activeRunId,
      },
      stream: { url: getProjectRunStreamUrl(projectId, run.id) },
    };
  }

  /**
   * Producer loop for a run. Only the first caller claims the producer and
   * drives the orchestrator; later callers (extra tabs) return immediately and
   * receive events via the hub fan-out. Handles three cases:
   *  - fresh run (reserved in this process)  → drive orchestrator
   *  - stale run (streaming in DB, no reservation — process restarted) → cleanup
   *  - terminal run (already finished)       → republish state for late joiners
   */
  async driveRun(projectId: string, runId: string, userId?: string): Promise<void> {
    if (!claimRunProducer(projectId, runId)) return;

    const run = await this.runStore.load(runId, userId).catch(() => undefined);
    if (!run) {
      publishRunEvent(projectId, runId, {
        type: "run.failed",
        runId,
        projectProcessingStatus: "idle",
        error: { code: "RUN_NOT_FOUND", message: "This run no longer exists." },
      });
      return;
    }

    if (run.status !== "streaming") {
      await this.republishTerminalRun(projectId, runId, userId);
      return;
    }

    const fresh = consumeRunReservation(projectId, runId);
    if (!fresh) {
      await this.cleanupStaleRun(projectId, runId, userId);
      return;
    }

    await this.runOrchestrator(projectId, runId, run.parentMessageId, run.userPrompt, userId);
  }

  private async runOrchestrator(
    projectId: string,
    runId: string,
    parentMessageId: string | undefined,
    prompt: string,
    userId?: string,
  ): Promise<void> {
    const signal = getRunAbortSignal(projectId, runId);
    const skeletonMapper = createSkeletonMapper(runId);

    publishRunEvent(projectId, runId, { type: "run.started", runId, projectId });

    let answerMessageId: string | null = null;
    let answerContent = "";
    let errored = false;

    const createAnswerIfNeeded = async () => {
      if (answerMessageId) return;
      const createdAt = new Date().toISOString();
      const message = await this.persistMilestone(
        projectId,
        runId,
        parentMessageId,
        "answer",
        "",
        "streaming",
        userId,
        createdAt,
      );
      answerMessageId = message.id;
    };

    try {
      for await (const event of this.agentOrchestrator.handlePromptStream({
        projectId,
        userId,
        prompt,
        runId,
        parentMessageId,
        signal,
      })) {
        if (isDevRuntimeEvent(event)) {
          publishRuntimeEvent(projectId, event);
          continue;
        }

        const skeleton = skeletonMapper(event);
        if (skeleton) publishRunEvent(projectId, runId, skeleton);

        if (event.type === "assistant_message_delta") {
          const delta = sanitizeForUser(event.delta);
          if (!delta) continue;
          await createAnswerIfNeeded();
          answerContent += delta;
          await this.messageRepository.updateMessage(answerMessageId!, {
            content: answerContent,
            processingStatus: "streaming",
            updatedAt: new Date().toISOString(),
          });
          publishRunEvent(projectId, runId, {
            type: "message.delta",
            runId,
            messageId: answerMessageId!,
            delta,
          });
          continue;
        }

        if (event.type === "error") errored = true;

        const milestone = decideMilestone(event);
        if (milestone) {
          await this.persistMilestone(
            projectId,
            runId,
            parentMessageId,
            milestone.kind,
            milestone.content,
            "completed",
            userId,
          );
        }
      }

      if (answerMessageId) {
        answerContent = answerContent.trim() || COMPLETED_FALLBACK_CONTENT;
        await this.messageRepository.updateMessage(answerMessageId, {
          content: answerContent,
          processingStatus: "completed",
          completedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        publishRunEvent(projectId, runId, {
          type: "message.completed",
          runId,
          messageId: answerMessageId,
          content: answerContent,
        });
      }

      await this.projectRepository.updateProjectProcessingState(projectId, "idle", userId);

      if (errored) {
        publishRunEvent(projectId, runId, {
          type: "run.failed",
          runId,
          projectProcessingStatus: "idle",
          error: { code: "PROVIDER_STREAM_FAILED", message: FAILED_FALLBACK_CONTENT },
        });
      } else {
        publishRunEvent(projectId, runId, {
          type: "run.completed",
          runId,
          projectProcessingStatus: "idle",
        });
      }
    } catch (error) {
      const aborted =
        signal.aborted ||
        (error instanceof DOMException && error.name === "AbortError");

      const run = await this.runStore.load(runId, userId).catch(() => undefined);

      if (aborted) {
        if (answerMessageId) {
          await this.messageRepository.updateMessage(answerMessageId, {
            processingStatus: "stopped",
            completedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
        if (run && run.status === "streaming") {
          await this.runStore.stop(run);
        }
        await this.projectRepository.updateProjectProcessingState(projectId, "idle", userId);
        publishRunEvent(projectId, runId, {
          type: "run.stopped",
          runId,
          projectProcessingStatus: "idle",
        });
        return;
      }

      const message = error instanceof Error ? error.message : "Agent run failed.";
      if (run && run.status === "streaming") {
        await this.runStore.fail(run, {
          code: "PROVIDER_STREAM_FAILED",
          message,
          recoverable: true,
        });
      }
      if (answerMessageId) {
        await this.messageRepository.updateMessage(answerMessageId, {
          processingStatus: "failed",
          completedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
      await this.projectRepository.updateProjectProcessingState(projectId, "idle", userId);
      publishRunEvent(projectId, runId, {
        type: "run.failed",
        runId,
        projectProcessingStatus: "idle",
        error: {
          code: "PROVIDER_STREAM_FAILED",
          message: "Could not complete the request. Please try again or adjust your prompt.",
        },
      });
    }
  }

  private async persistMilestone(
    projectId: string,
    runId: string,
    parentMessageId: string | undefined,
    kind: AgentMessageKind,
    content: string,
    processingStatus: Message["processingStatus"],
    userId?: string,
    createdAt?: string,
  ): Promise<Message> {
    const now = createdAt ?? new Date().toISOString();
    const message = await this.messageRepository.saveMessage(
      {
        id: crypto.randomUUID(),
        userId,
        projectId,
        role: "agent",
        content,
        status: "completed",
        processingStatus,
        parentMessageId,
        runId,
        kind,
        provider: "agent-orchestrator",
        createdAt: now,
        updatedAt: now,
      },
      userId,
    );
    publishRunEvent(projectId, runId, {
      type: "message.created",
      runId,
      messageId: message.id,
      kind,
      content,
      processingStatus,
      createdAt: now,
    });
    return message;
  }

  /** Re-emit a finished run's state for a client that connects after completion. */
  private async republishTerminalRun(projectId: string, runId: string, userId?: string) {
    const run = await this.runStore.load(runId, userId).catch(() => undefined);
    if (!run) return;
    publishRunEvent(projectId, runId, { type: "run.started", runId, projectId });
    const messages = await this.messageRepository.listMessagesByRunId(runId, userId);
    for (const message of messages) {
      if (!message.kind) continue;
      publishRunEvent(projectId, runId, {
        type: "message.created",
        runId,
        messageId: message.id,
        kind: message.kind,
        content: message.content,
        processingStatus: message.processingStatus,
        createdAt: message.createdAt,
      });
    }
    const terminal: RunStreamEvent =
      run.status === "failed"
        ? {
            type: "run.failed",
            runId,
            projectProcessingStatus: "idle",
            error: {
              code: "PROVIDER_STREAM_FAILED",
              message: run.error?.message ?? FAILED_FALLBACK_CONTENT,
            },
          }
        : run.status === "stopped"
          ? { type: "run.stopped", runId, projectProcessingStatus: "idle" }
          : { type: "run.completed", runId, projectProcessingStatus: "idle" };
    publishRunEvent(projectId, runId, terminal);
  }

  /** A run left "streaming" by a since-restarted process: fail it and free the project. */
  private async cleanupStaleRun(projectId: string, runId: string, userId?: string) {
    const run = await this.runStore.load(runId, userId).catch(() => undefined);
    if (run && run.status === "streaming") {
      await this.runStore.fail(run, {
        code: "RUN_INTERRUPTED",
        message: "The run was interrupted and could not be resumed.",
        recoverable: true,
      });
    }
    const messages = await this.messageRepository.listMessagesByRunId(runId, userId);
    for (const message of messages) {
      if (message.processingStatus === "streaming") {
        await this.messageRepository.updateMessage(message.id, {
          processingStatus: "failed",
          completedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    }
    await this.projectRepository.updateProjectProcessingState(projectId, "idle", userId);
    publishRunEvent(projectId, runId, { type: "run.started", runId, projectId });
    publishRunEvent(projectId, runId, {
      type: "run.failed",
      runId,
      projectProcessingStatus: "idle",
      error: {
        code: "RUN_INTERRUPTED",
        message: "This run was interrupted. You can retry safely.",
      },
    });
  }

  /** Idempotent stop. Aborts the producer loop; no-op if the run is already terminal. */
  async stopRun(projectId: string, runId: string, userId?: string) {
    const project = await this.projectRepository.getProject(projectId, userId);
    if (!project) throw new Error("Project not found.");
    const run = await this.runStore.load(runId, userId).catch(() => undefined);
    if (!run) throw new Error("Run not found.");

    if (run.status !== "streaming") {
      return { runId, status: run.status, projectProcessingStatus: project.processingStatus };
    }

    abortRun(projectId, runId);

    return { runId, status: "stopped" as const, projectProcessingStatus: "idle" as const };
  }

  /** Retry a failed run: create a fresh run reusing the original user prompt. */
  async retryRun(
    projectId: string,
    runId: string,
    options: CreateRunOptions = {},
    userId?: string,
  ): Promise<{ newRunId: string; streamUrl: string }> {
    const project = await this.projectRepository.getProject(projectId, userId);
    if (!project) throw new Error("Project not found.");
    if (project.processingStatus === "processing") {
      throw new Error("This project is already generating a response.");
    }

    const oldRun = await this.runStore.load(runId, userId).catch(() => undefined);
    if (!oldRun) throw new Error("Run not found.");
    if (oldRun.status !== "failed") {
      throw new Error("Only failed runs can be retried.");
    }

    const newRun = await this.runStore.create({
      projectId,
      userId,
      parentMessageId: oldRun.parentMessageId,
      retryOfRunId: oldRun.id,
      userPrompt: oldRun.userPrompt,
      reasoningEffort: options.reasoningEffort ?? oldRun.reasoningEffort,
      planMode: options.planMode ?? oldRun.planMode,
      status: "streaming",
    });

    await this.projectRepository.updateProjectProcessingState(
      projectId,
      "processing",
      userId,
      newRun.id,
      new Date().toISOString(),
    );

    reserveRunProducer(projectId, newRun.id);

    return { newRunId: newRun.id, streamUrl: getProjectRunStreamUrl(projectId, newRun.id) };
  }
}

function normalizeCursor(cursor?: MessageCursor): MessageCursor {
  const limit = Math.min(Math.max(cursor?.limit ?? 50, 1), 100);
  if (
    cursor?.beforeCreatedAt &&
    Number.isNaN(new Date(cursor.beforeCreatedAt).getTime())
  ) {
    throw new Error("Invalid cursor.");
  }
  return {
    beforeCreatedAt: cursor?.beforeCreatedAt,
    beforeId: cursor?.beforeId,
    limit,
  };
}
