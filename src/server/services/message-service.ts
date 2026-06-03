import type { AgentOrchestrator } from "@/features/ai-agent/agent/agent-orchestrator.server";
import type { AgentStreamEvent } from "@/features/ai-agent/agent/agent-events";
import type { ProjectRunStore } from "@/features/ai-agent/project/project-run-store.server";
import type { DevRuntimeEvent } from "@/features/ai-agent/runtime/runtime-events";
import {
  sanitizeForUser,
  redactTechnicalText,
  detectUserLanguage,
  buildFriendlyErrorContent,
  interruptedAnswerSuffix,
  stillWorkingLabel,
  type UserLanguage,
} from "@/features/ai-agent/agent/user-facing-presenter";
import { createSkeletonMapper } from "@/features/ai-agent/agent/agent-event-to-skeleton";
import { decideMilestone } from "@/features/ai-agent/agent/agent-event-to-milestone";
import type {
  AgentMessageKind,
  AgentQuestionMetadata,
  ComposerReasoningEffort,
  DesignVariant,
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
const STILL_WORKING_MS = 20_000;

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
    const { map: skeletonMapper, setPageProgress } = createSkeletonMapper(runId);
    const language = detectUserLanguage({ userPrompt: prompt });

    publishRunEvent(projectId, runId, { type: "run.started", runId, projectId });

    let answerMessageId: string | null = null;
    let answerContent = "";
    let lastPhase: Exclude<import("@/shared/project-types").SkeletonPhase, "starting"> = "understanding";
    let runError: { code?: string; rawMessage?: string } | null = null;

    // "Still working" nudge: if a phase goes quiet (no event) for STILL_WORKING_MS
    // before the answer starts streaming, reassure the user once until the next
    // event arrives. Keeps a long model call from feeling like a dead UI.
    let stillWorkingTimer: ReturnType<typeof setTimeout> | null = null;
    let stillWorkingEmitted = false;
    const clearStillWorking = () => {
      if (stillWorkingTimer) clearTimeout(stillWorkingTimer);
      stillWorkingTimer = null;
    };
    const armStillWorking = () => {
      clearStillWorking();
      stillWorkingEmitted = false;
      stillWorkingTimer = setTimeout(() => {
        if (answerMessageId || stillWorkingEmitted) return; // only before answer streams (B); once per quiet window
        stillWorkingEmitted = true;
        publishRunEvent(projectId, runId, {
          type: "skeleton.update",
          runId,
          phase: lastPhase,
          label: stillWorkingLabel(language),
        });
      }, STILL_WORKING_MS);
    };

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

    // Persists a user-facing error outcome. Before any answer text -> a friendly
    // `error` milestone. Mid-answer -> keep the partial, append an interrupted
    // hint, and mark it failed (the run.failed reducer flips streaming -> failed).
    // Raw provider error is logged for debugging but never shown to the user.
    const persistErrorOutcome = async (code?: string, rawMessage?: string) => {
      if (rawMessage) {
        console.error(
          JSON.stringify({ event: "agent_run_error", projectId, runId, code, rawMessage }),
        );
      }
      if (answerMessageId && answerContent.trim()) {
        const suffix = interruptedAnswerSuffix(language);
        answerContent += suffix;
        await this.messageRepository.updateMessage(answerMessageId, {
          content: answerContent,
          processingStatus: "failed",
          completedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        publishRunEvent(projectId, runId, {
          type: "message.delta",
          runId,
          messageId: answerMessageId,
          delta: suffix,
        });
      } else {
        await this.persistMilestone(
          projectId,
          runId,
          parentMessageId,
          "error",
          buildFriendlyErrorContent({ code, rawMessage, language }),
          "completed",
          userId,
        );
      }
    };

    try {
      armStillWorking();
      for await (const event of this.agentOrchestrator.handlePromptStream({
        projectId,
        userId,
        prompt,
        runId,
        parentMessageId,
        signal,
      })) {
        armStillWorking();

        if (isDevRuntimeEvent(event)) {
          publishRuntimeEvent(projectId, event);
          continue;
        }

        const skeleton = skeletonMapper(event);
        if (skeleton) {
          lastPhase = skeleton.phase;
          publishRunEvent(projectId, runId, skeleton);
        }

        if (event.type === "assistant_message_delta") {
          // Per-delta: redact technical tokens only. Do NOT trim/collapse here — a
          // trailing trim on each chunk eats boundary spaces and sticks words together
          // ("sẵn sàng.Khách"). Whitespace is normalized once on completion below.
          const delta = redactTechnicalText(event.delta);
          if (!delta) continue;
          clearStillWorking(); // answer is streaming; user sees output now
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

        if (event.type === "error") {
          runError = { code: event.code, rawMessage: event.message };
          continue;
        }

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

      clearStillWorking();

      if (runError) {
        await persistErrorOutcome(runError.code, runError.rawMessage);
        await this.projectRepository.updateProjectProcessingState(projectId, "idle", userId);
        publishRunEvent(projectId, runId, {
          type: "run.failed",
          runId,
          projectProcessingStatus: "idle",
          error: {
            code: "PROVIDER_STREAM_FAILED",
            message: buildFriendlyErrorContent({ code: runError.code, rawMessage: runError.rawMessage, language }),
          },
        });
        return;
      }

      if (answerMessageId) {
        // Normalize whitespace once on the COMPLETE accumulated text. message.completed
        // carries the clean content, replacing the redact-only streamed deltas.
        answerContent = sanitizeForUser(answerContent) || COMPLETED_FALLBACK_CONTENT;
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
      } else {
        // Guard: a successful run must leave at least one agent message. If the
        // orchestrator produced no answer and no milestone, synthesize a default
        // answer so the user never sees an empty result.
        const existing = await this.messageRepository.listMessagesByRunId(runId, userId);
        const hasAgentMessage = existing.some((m) => m.role === "agent");
        if (!hasAgentMessage) {
          await this.persistMilestone(
            projectId,
            runId,
            parentMessageId,
            "answer",
            COMPLETED_FALLBACK_CONTENT,
            "completed",
            userId,
          );
        }
      }

      await this.projectRepository.updateProjectProcessingState(projectId, "idle", userId);
      publishRunEvent(projectId, runId, {
        type: "run.completed",
        runId,
        projectProcessingStatus: "idle",
      });
    } catch (error) {
      clearStillWorking();
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

      const rawMessage = error instanceof Error ? error.message : "Agent run failed.";
      if (run && run.status === "streaming") {
        await this.runStore.fail(run, {
          code: "PROVIDER_STREAM_FAILED",
          message: rawMessage,
          recoverable: true,
        });
      }
      // Always leave a user-facing message (error milestone, or partial answer
      // marked interrupted) — never a silent failure.
      await persistErrorOutcome(undefined, rawMessage);
      await this.projectRepository.updateProjectProcessingState(projectId, "idle", userId);
      publishRunEvent(projectId, runId, {
        type: "run.failed",
        runId,
        projectProcessingStatus: "idle",
        error: {
          code: "PROVIDER_STREAM_FAILED",
          message: buildFriendlyErrorContent({ rawMessage, language }),
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
    metadata?: AgentQuestionMetadata,
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
        metadata: kind === "agent_question" ? metadata ?? null : null,
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

    // T024: Emit run.awaiting_input when agent_question milestone is persisted
    if (kind === "agent_question") {
      publishRunEvent(projectId, runId, {
        type: "run.awaiting_input",
        runId,
      });
    }

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

    if (run.status !== "streaming" && run.status !== "awaiting_input") {
      return { runId, status: run.status, projectProcessingStatus: project.processingStatus };
    }

    abortRun(projectId, runId);

    return { runId, status: "stopped" as const, projectProcessingStatus: "idle" as const };
  }

  /** T023: User selects an option from an agent_question message. */
  async selectOption(
    projectId: string,
    runId: string,
    optionId: string,
    userId?: string,
  ): Promise<{
    runId: string;
    messageId: string;
    selectedOptionId: string;
    status: "streaming";
  }> {
    const run = await this.runStore.load(runId, userId).catch(() => undefined);
    if (!run) throw Object.assign(new Error("Run not found"), { code: "RUN_NOT_FOUND" as const });

    if (run.status !== "awaiting_input") {
      throw Object.assign(new Error("Run is not awaiting input"), {
        code: "RUN_NOT_AWAITING_INPUT" as const,
      });
    }

    const messages = await this.messageRepository.listMessagesByRunId(runId, userId);
    const questionMessage = messages.findLast((m) => m.kind === "agent_question");
    if (!questionMessage) {
      throw Object.assign(new Error("No agent question found for this run"), {
        code: "INVALID_OPTION" as const,
      });
    }

    const metadata = questionMessage.metadata;
    if (!metadata?.options?.length) {
      throw Object.assign(new Error("Invalid question metadata"), {
        code: "INVALID_OPTION" as const,
      });
    }

    if (metadata.selectedOptionId) {
      throw Object.assign(new Error("Option already selected for this question"), {
        code: "OPTION_ALREADY_SELECTED" as const,
      });
    }

    const option = metadata.options.find((o) => o.id === optionId);
    if (!option) {
      throw Object.assign(new Error(`Option "${optionId}" not found in question options`), {
        code: "INVALID_OPTION" as const,
      });
    }

    // Update message metadata
    const updatedMetadata: AgentQuestionMetadata = {
      ...metadata,
      selectedOptionId: optionId,
    };
    await this.messageRepository.updateMessage(questionMessage.id, {
      metadata: updatedMetadata,
      updatedAt: new Date().toISOString(),
    } as Partial<Message>);

    // Resume run: awaiting_input → streaming
    await this.runStore.update(run, { status: "streaming" });

    // Broadcast option.selected to all tabs
    publishRunEvent(projectId, runId, {
      type: "option.selected",
      runId,
      messageId: questionMessage.id,
      optionId,
    });

    return {
      runId,
      messageId: questionMessage.id,
      selectedOptionId: optionId,
      status: "streaming",
    };
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
