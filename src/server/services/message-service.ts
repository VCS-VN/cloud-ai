import {
  AIProviderConfigurationError,
} from "@/ai/ai-provider";
import type { AgentRuntime } from "@/agent/agent-runtime";
import type { AgentOrchestrator } from "@/features/ai-agent/agent/agent-orchestrator.server";
import type { AgentStreamEvent } from "@/features/ai-agent/agent/agent-events";
import type {
  ComposerReasoningEffort,
  Message,
  MessageCursor,
  MessagePage,
  MessageStreamEvent,
  MessageStreamState,
} from "@/shared/project-types";
import type {
  ProjectMessageRepository,
  ProjectRepository,
} from "@/shared/project-types";
import {
  abortProjectMessageStream,
  getProjectMessageStreamUrl,
} from "@/server/functions/project-message-stream";

type SendMessageOptions = {
  reasoningEffort?: ComposerReasoningEffort;
  planMode?: boolean;
};

function normalizeSendMessageArgs(
  optionsOrUserId?: SendMessageOptions | string,
  userId?: string,
) {
  return typeof optionsOrUserId === "string"
    ? { options: undefined, userId: optionsOrUserId }
    : { options: optionsOrUserId, userId };
}

function normalizeStreamMessageArgs(
  optionsOrUserId?: SendMessageOptions | string,
  userId?: string,
) {
  return typeof optionsOrUserId === "string"
    ? { options: undefined, userId: optionsOrUserId }
    : { options: optionsOrUserId, userId };
}

function assertMessageContent(content: string) {
  const trimmed = content.trim();
  if (!trimmed) throw new Error("Message cannot be empty.");
  return trimmed;
}

export class MessageService {
  constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly messageRepository: ProjectMessageRepository,
    private readonly agentRuntime?: AgentRuntime,
    private readonly agentOrchestrator?: AgentOrchestrator,
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

  async sendProjectMessage(
    projectId: string,
    content: string,
    optionsOrUserId?: SendMessageOptions | string,
    userId?: string,
  ): Promise<MessageStreamState> {
    const { options, userId: resolvedUserId } = normalizeSendMessageArgs(
      optionsOrUserId,
      userId,
    );
    const project = await this.projectRepository.getProject(projectId, resolvedUserId);
    if (!project) throw new Error("Project not found.");
    if (project.processingStatus === "processing") {
      throw new Error("This project is already generating a response.");
    }

    const now = new Date().toISOString();
    const userMessage = await this.messageRepository.saveMessage(
      {
        id: crypto.randomUUID(),
        userId: resolvedUserId,
        projectId,
        role: "user",
        content: assertMessageContent(content),
        status: "completed",
        processingStatus: "completed",
        createdAt: now,
        updatedAt: now,
      },
      resolvedUserId,
    );

    const agentMessage = await this.messageRepository.saveMessage(
      {
        id: crypto.randomUUID(),
        userId: resolvedUserId,
        projectId,
        role: "agent",
        content: "",
        status: "pending",
        processingStatus: "pending",
        parentMessageId: userMessage.id,
        provider: "agent-orchestrator",
        createdAt: new Date(Date.parse(now) + 1).toISOString(),
        updatedAt: new Date(Date.parse(now) + 1).toISOString(),
      },
      resolvedUserId,
    );

    const nextProject =
      await this.projectRepository.updateProjectProcessingState(
        projectId,
        "processing",
        resolvedUserId,
        agentMessage.id,
        now,
      );
    if (!nextProject) throw new Error("Project not found.");

    return {
      project: {
        id: nextProject.id,
        processingStatus: nextProject.processingStatus,
        activeAgentMessageId: nextProject.activeAgentMessageId,
      },
      userMessage,
      agentMessage,
      stream: {
        url: getProjectMessageStreamUrl(projectId, agentMessage.id, options),
      },
    };
  }

  async streamProjectMessage(
    projectId: string,
    agentMessageId: string,
    emit: (event: MessageStreamEvent) => Promise<void> | void,
    signal?: AbortSignal,
    optionsOrUserId?: SendMessageOptions | string,
    userId?: string,
  ) {
    const { options, userId: resolvedUserId } = normalizeStreamMessageArgs(
      optionsOrUserId,
      userId,
    );
    const project = await this.projectRepository.getProject(projectId, resolvedUserId);
    if (!project) throw new Error("Project not found.");

    const agentMessage = await this.messageRepository.getMessage(
      projectId,
      agentMessageId,
      resolvedUserId,
    );
    if (!agentMessage || agentMessage.role !== "agent") {
      throw new Error("Message not found.");
    }

    if (
      agentMessage.processingStatus === "completed" ||
      agentMessage.processingStatus === "failed" ||
      agentMessage.processingStatus === "stopped"
    ) {
      await emit({
        type: `message.${agentMessage.processingStatus}` as const,
        messageId: agentMessage.id,
        content: agentMessage.content,
        processingStatus: agentMessage.processingStatus,
        projectProcessingStatus: project.processingStatus,
        providerResponseId: agentMessage.providerResponseId,
        ...(agentMessage.processingStatus === "failed" &&
        agentMessage.errorMessage
          ? {
              error: {
                code: "PROVIDER_STREAM_FAILED" as const,
                message: agentMessage.errorMessage,
              },
            }
          : {}),
      });
      return;
    }

    const page = await this.messageRepository.listMessages(projectId, resolvedUserId, {
      limit: 100,
    });
    const promptMessage =
      (agentMessage.parentMessageId
        ? page.messages.find(
            (message) => message.id === agentMessage.parentMessageId,
          )
        : undefined) ??
      [...page.messages].reverse().find((message) => message.role === "user");

    if (!promptMessage) throw new Error("Message not found.");

    if (this.agentOrchestrator) {
      await this.streamAgentOrchestratorMessage({
        projectId,
        agentMessageId,
        agentMessage,
        parentMessageId: promptMessage.id,
        prompt: promptMessage.content,
        emit,
        signal,
        userId: resolvedUserId,
      });
      return;
    }

    if (agentMessage.provider === "workspace-agent") {
      await this.streamWorkspaceAgentMessage({
        projectId,
        agentMessageId,
        agentMessage,
        prompt: promptMessage.content,
        emit,
        signal,
        userId: resolvedUserId,
      });
      return;
    }

    throw new AIProviderConfigurationError(
      "PROVIDER_NOT_CONFIGURED",
      "Agent orchestrator is not available.",
    );
  }

  private async streamAgentOrchestratorMessage(args: {
    projectId: string;
    agentMessageId: string;
    agentMessage: Message;
    parentMessageId?: string;
    prompt: string;
    emit: (event: MessageStreamEvent) => Promise<void> | void;
    signal?: AbortSignal;
    userId?: string;
  }) {
    if (!this.agentOrchestrator) {
      throw new AIProviderConfigurationError(
        "PROVIDER_NOT_CONFIGURED",
        "Agent orchestrator is not available.",
      );
    }

    const existingChunks = await this.messageRepository.listAgentMessageChunks(args.agentMessageId, args.userId);
    let aggregatedContent = args.agentMessage.content || existingChunks.map((chunk) => chunk.content).join("");
    let sequence = existingChunks.reduce((max, chunk) => Math.max(max, chunk.sequence), 0);
    const startedAt = args.agentMessage.startedAt ?? new Date().toISOString();
    const streamStartedAt = Date.now();

    console.info(
      JSON.stringify({
        event: "agent_message_stream_started",
        projectId: args.projectId,
        messageId: args.agentMessageId,
        userId: args.userId,
      }),
    );

    await this.messageRepository.updateMessage(args.agentMessageId, {
      processingStatus: "streaming",
      provider: "agent-orchestrator",
      startedAt,
      updatedAt: new Date().toISOString(),
    });
    await args.emit({
      type: "message.started",
      projectId: args.projectId,
      messageId: args.agentMessageId,
      processingStatus: "streaming",
    });

    const toUserFacingDelta = createAgentMessageDeltaPresenter();
    let hasTerminalUserFacingDelta = false;

    const emitDelta = async (delta: string, providerEventType: string) => {
      sequence += 1;
      aggregatedContent += delta;
      await this.messageRepository.saveAgentMessageChunk(
        {
          id: crypto.randomUUID(),
          projectId: args.projectId,
          messageId: args.agentMessageId,
          userId: args.userId,
          sequence,
          content: delta,
          providerEventType,
          createdAt: new Date().toISOString(),
        },
        args.userId,
      );
      await this.messageRepository.updateMessage(args.agentMessageId, {
        content: aggregatedContent,
        processingStatus: "streaming",
        startedAt,
        updatedAt: new Date().toISOString(),
      });
      await args.emit({
        type: "message.delta",
        messageId: args.agentMessageId,
        sequence,
        delta,
      });
    };

    try {
      for await (const event of this.agentOrchestrator.handlePromptStream({
        projectId: args.projectId,
        userId: args.userId,
        prompt: args.prompt,
        messageId: args.agentMessageId,
        parentMessageId: args.parentMessageId,
        signal: args.signal,
      })) {
        console.info(
          JSON.stringify({
            event: "agent_orchestrator_event",
            projectId: args.projectId,
            messageId: args.agentMessageId,
            agentEventType: event.type,
            elapsedMs: Date.now() - streamStartedAt,
          }),
        );
        const delta = toUserFacingDelta(event);
        if (delta) {
          if (event.type === "done" || event.type === "error") hasTerminalUserFacingDelta = true;
          await emitDelta(delta, event.type);
        }
        if (event.type === "error") {
          throw new Error(event.message);
        }
      }

      await this.messageRepository.updateMessage(args.agentMessageId, {
        content: aggregatedContent,
        processingStatus: "completed",
        startedAt,
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        errorMessage: undefined,
      });
      await this.projectRepository.updateProjectProcessingState(
        args.projectId,
        "idle",
        args.userId,
      );
      await args.emit({
        type: "message.completed",
        messageId: args.agentMessageId,
        content: aggregatedContent,
        processingStatus: "completed",
        projectProcessingStatus: "idle",
      });
      console.info(
        JSON.stringify({
          event: "agent_message_stream_completed",
          projectId: args.projectId,
          messageId: args.agentMessageId,
          chunks: sequence,
          totalChars: aggregatedContent.length,
          elapsedMs: Date.now() - streamStartedAt,
        }),
      );
    } catch (error) {
      const aborted = args.signal?.aborted || (error instanceof DOMException && error.name === "AbortError");
      const processingStatus = aborted ? "stopped" : "failed";
      const message = error instanceof Error ? error.message : "Agent orchestrator failed.";
      if (aborted && !hasTerminalUserFacingDelta) {
        aggregatedContent = appendUserFacingLine(aggregatedContent, "Processing stopped. You can continue with a new prompt.");
      }
      if (!aborted && !hasTerminalUserFacingDelta) {
        aggregatedContent = appendUserFacingLine(aggregatedContent, "Could not complete the request. Please try again or adjust your prompt.");
      }
      await this.messageRepository.updateMessage(args.agentMessageId, {
        content: aggregatedContent,
        processingStatus,
        startedAt,
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        errorMessage: aborted ? undefined : message,
      });
      await this.projectRepository.updateProjectProcessingState(args.projectId, "idle", args.userId);
      await args.emit({
        type: aborted ? "message.stopped" : "message.failed",
        messageId: args.agentMessageId,
        content: aggregatedContent,
        processingStatus,
        projectProcessingStatus: "idle",
        ...(aborted
          ? {}
          : {
              error: {
                code: "PROVIDER_STREAM_FAILED" as const,
                message: "Could not complete the request. Please try again or adjust your prompt.",
              },
            }),
      });
      console.error(
        JSON.stringify({
          event: aborted ? "agent_message_stream_stopped" : "agent_message_stream_failed",
          projectId: args.projectId,
          messageId: args.agentMessageId,
          chunks: sequence,
          error: aborted ? undefined : message,
          elapsedMs: Date.now() - streamStartedAt,
        }),
      );
    }
  }

  private async streamWorkspaceAgentMessage(args: {
    projectId: string;
    agentMessageId: string;
    agentMessage: Message;
    prompt: string;
    emit: (event: MessageStreamEvent) => Promise<void> | void;
    signal?: AbortSignal;
    userId?: string;
  }) {
    if (!this.agentRuntime) {
      throw new AIProviderConfigurationError(
        "PROVIDER_NOT_CONFIGURED",
        "Workspace agent runtime is not available.",
      );
    }

    const existingChunks = await this.messageRepository.listAgentMessageChunks(args.agentMessageId, args.userId);
    let aggregatedContent = args.agentMessage.content || existingChunks.map((chunk) => chunk.content).join("");
    let sequence = existingChunks.reduce((max, chunk) => Math.max(max, chunk.sequence), 0);
    const startedAt = args.agentMessage.startedAt ?? new Date().toISOString();

    await this.messageRepository.updateMessage(args.agentMessageId, {
      processingStatus: "streaming",
      provider: "workspace-agent",
      startedAt,
      updatedAt: new Date().toISOString(),
    });
    await args.emit({
      type: "message.started",
      projectId: args.projectId,
      messageId: args.agentMessageId,
      processingStatus: "streaming",
    });

    const emitDelta = async (delta: string) => {
      sequence += 1;
      aggregatedContent += delta;
      await this.messageRepository.saveAgentMessageChunk(
        {
          id: crypto.randomUUID(),
          projectId: args.projectId,
          messageId: args.agentMessageId,
          userId: args.userId,
          sequence,
          content: delta,
          providerEventType: "workspace-agent.delta",
          createdAt: new Date().toISOString(),
        },
        args.userId,
      );
      await this.messageRepository.updateMessage(args.agentMessageId, {
        content: aggregatedContent,
        processingStatus: "streaming",
        startedAt,
        updatedAt: new Date().toISOString(),
      });
      await args.emit({
        type: "message.delta",
        messageId: args.agentMessageId,
        sequence,
        delta,
      });
    };

    try {
      const result = await this.agentRuntime.run({
        projectId: args.projectId,
        userId: args.userId,
        prompt: args.prompt,
        mode: "init",
        signal: args.signal,
        emit: emitDelta,
      });

      const finalDelta = result.summary.trim()
        ? `${aggregatedContent ? "\n" : ""}${result.summary.trim()}`
        : "";
      if (finalDelta) await emitDelta(finalDelta);

      await this.messageRepository.updateMessage(args.agentMessageId, {
        content: aggregatedContent,
        processingStatus: "completed",
        startedAt,
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        errorMessage: undefined,
      });
      await this.projectRepository.updateProjectProcessingState(
        args.projectId,
        "idle",
        args.userId,
      );
      await args.emit({
        type: "message.completed",
        messageId: args.agentMessageId,
        content: aggregatedContent,
        processingStatus: "completed",
        projectProcessingStatus: "idle",
      });
    } catch (error) {
      const aborted =
        args.signal?.aborted ||
        (error instanceof DOMException && error.name === "AbortError");
      const processingStatus = aborted ? "stopped" : "failed";
      await this.messageRepository.updateMessage(args.agentMessageId, {
        content: aggregatedContent,
        processingStatus,
        startedAt,
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        errorMessage: aborted
          ? undefined
          : error instanceof Error
            ? error.message
            : "Workspace agent failed.",
      });
      await this.projectRepository.updateProjectProcessingState(
        args.projectId,
        "idle",
        args.userId,
      );
      await args.emit({
        type: aborted ? "message.stopped" : "message.failed",
        messageId: args.agentMessageId,
        content: aggregatedContent,
        processingStatus,
        projectProcessingStatus: "idle",
        ...(aborted
          ? {}
          : {
              error: {
                code: "PROVIDER_STREAM_FAILED" as const,
                message:
                  error instanceof Error ? error.message : "Workspace agent failed.",
              },
            }),
      });
    }
  }

  async stopProjectGeneration(
    projectId: string,
    messageId: string,
    userId?: string,
  ) {
    const project = await this.projectRepository.getProject(projectId, userId);
    if (!project) throw new Error("Project not found.");

    const message = await this.messageRepository.getMessage(
      projectId,
      messageId,
      userId,
    );
    if (!message) throw new Error("Message not found.");

    if (
      message.processingStatus === "completed" ||
      message.processingStatus === "failed" ||
      message.processingStatus === "stopped"
    ) {
      return { project, agentMessage: message };
    }

    abortProjectMessageStream(projectId, messageId);

    const stoppedMessage = await this.messageRepository.updateMessage(
      messageId,
      {
        processingStatus: "stopped",
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    );
    const nextProject =
      await this.projectRepository.updateProjectProcessingState(
        projectId,
        "idle",
        userId,
      );
    if (!stoppedMessage || !nextProject) throw new Error("Message not found.");

    return {
      project: nextProject,
      agentMessage: stoppedMessage,
    };
  }

  async retryProjectMessage(
    projectId: string,
    messageId: string,
    userId?: string,
  ): Promise<Message> {
    const project = await this.projectRepository.getProject(projectId, userId);
    if (!project) throw new Error("Project not found.");
    const page = await this.messageRepository.listMessages(projectId, userId, {
      limit: 100,
    });
    const message = page.messages.find((item) => item.id === messageId);
    if (!message) throw new Error("Message not found.");
    if (message.processingStatus !== "failed")
      throw new Error("Only failed messages can be retried.");
    const updated = await this.messageRepository.updateMessageProcessingStatus(
      messageId,
      "completed",
    );
    if (!updated) throw new Error("Message not found.");
    return {
      ...updated,
      content:
        updated.content || "Retry completed with safe placeholder response.",
    };
  }
}

function createAgentMessageDeltaPresenter() {
  const emitted = new Set<string>();

  return (event: AgentStreamEvent) => {
    const message = agentEventToUserFacingMessage(event);
    if (!message) return undefined;
    const key =
      event.type === "assistant_message_delta" ? `${event.type}:${message}` : message;
    if (emitted.has(key)) return undefined;
    emitted.add(key);
    return `${message}${message.endsWith("\n") ? "" : "\n"}`;
  };
}

export function agentEventToUserFacingMessage(event: AgentStreamEvent) {
  switch (event.type) {
    case "thinking_started":
      return event.message;
    case "user_wish_extracted":
      return `Understood: ${event.understanding}`;
    case "thinking_completed":
      return "Task identified. Planning...";
    case "thinking_needs_clarification":
      return `Clarification needed: ${event.question}`;
    case "intent_detected":
      if (event.intent.intent === "init_project") return "Initializing project...";
      if (event.intent.intent === "explain_project") return "Inspecting project...";
      return "Updating page...";
    case "source_generation_started":
      return /incremental|patch|update/i.test(event.message)
        ? "Updating page..."
        : "Creating page...";
    case "assistant_message_delta":
      return undefined;
    case "done":
      return getDoneMessageForUser(event.summary);
    case "error":
      return "Could not complete the request. Please try again or adjust your prompt.";
    default:
      return undefined;
  }
}


function getDoneMessageForUser(summary: string) {
  if (/init|initial|khởi tạo|generated|storefront files|from template/i.test(summary)) {
    return "Done. Project initialized successfully.";
  }
  if (/add|create|new|thêm|tạo/i.test(summary)) {
    return "Done. New request added successfully.";
  }
  return "Done. Content updated successfully.";
}

function appendUserFacingLine(content: string, line: string) {
  const separator = content && !content.endsWith("\n") ? "\n" : "";
  return `${content}${separator}${line}\n`;
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
