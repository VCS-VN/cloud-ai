import {
  AIProviderConfigurationError,
  type AIProvider,
} from "@/ai/ai-provider";
import { buildProjectMessageInput } from "@/ai/prompt-builder";
import type { AgentRuntime } from "@/agent/agent-runtime";
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
    private readonly aiProviderFactory: () => AIProvider,
    private readonly agentRuntime?: AgentRuntime,
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
        provider: "openai",
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

    const history = buildProjectMessageInput({
      prompt: promptMessage.content,
      history: page.messages.filter(
        (message) => message.id !== agentMessage.id,
      ),
    });

    const provider = this.aiProviderFactory();
    if (!provider.streamProjectMessage) {
      throw new AIProviderConfigurationError(
        "PROVIDER_NOT_CONFIGURED",
        "Streaming provider is not available.",
      );
    }

    let aggregatedContent = agentMessage.content;
    const startedAt = agentMessage.startedAt ?? new Date().toISOString();

    await provider.streamProjectMessage(
      {
        projectId,
        messageId: agentMessageId,
        prompt: promptMessage.content,
        history,
        reasoningEffort: options?.reasoningEffort,
        planMode: options?.planMode,
        signal,
      },
      {
        onStarted: async (event) => {
          await this.messageRepository.updateMessage(agentMessageId, {
            processingStatus: "streaming",
            provider: "openai",
            providerResponseId: event.providerResponseId,
            startedAt,
            updatedAt: new Date().toISOString(),
          });
          await emit(event);
        },
        onDelta: async (event) => {
          aggregatedContent += event.delta;
          await this.messageRepository.saveAgentMessageChunk(
            {
              id: crypto.randomUUID(),
              projectId,
              messageId: agentMessageId,
              userId,
              sequence: event.sequence,
              content: event.delta,
              providerEventType: "response.output_text.delta",
              createdAt: new Date().toISOString(),
            },
            userId,
          );
          await this.messageRepository.updateMessage(agentMessageId, {
            content: aggregatedContent,
            processingStatus: "streaming",
            startedAt,
            updatedAt: new Date().toISOString(),
          });
          await emit(event);
        },
        onCompleted: async (event) => {
          await this.messageRepository.updateMessage(agentMessageId, {
            content: aggregatedContent,
            processingStatus: "completed",
            providerResponseId: event.providerResponseId,
            startedAt,
            completedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            errorMessage: undefined,
          });
          await this.projectRepository.updateProjectProcessingState(
            projectId,
            "idle",
            userId,
          );
          await emit({ ...event, content: aggregatedContent });
        },
        onFailed: async (event) => {
          await this.messageRepository.updateMessage(agentMessageId, {
            content: aggregatedContent,
            processingStatus: "failed",
            providerResponseId: event.providerResponseId,
            startedAt,
            completedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            errorMessage: event.error?.message,
          });
          await this.projectRepository.updateProjectProcessingState(
            projectId,
            "idle",
            userId,
          );
          await emit({ ...event, content: aggregatedContent });
        },
        onStopped: async (event) => {
          await this.messageRepository.updateMessage(agentMessageId, {
            content: aggregatedContent,
            processingStatus: "stopped",
            providerResponseId: event.providerResponseId,
            startedAt,
            completedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          await this.projectRepository.updateProjectProcessingState(
            projectId,
            "idle",
            userId,
          );
          await emit({ ...event, content: aggregatedContent });
        },
        onHeartbeat: emit,
      },
    );
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

    let aggregatedContent = args.agentMessage.content;
    let sequence = 0;
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
