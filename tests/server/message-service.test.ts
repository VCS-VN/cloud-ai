import { describe, expect, it } from "vitest";
import type { AIProvider } from "@/ai/ai-provider";
import { MessageService } from "@/server/services/message-service";
import type {
  AgentMessageChunk,
  Message,
  MessageCursor,
  MessagePage,
  Project,
  ProjectMessageRepository,
  ProjectRepository,
} from "@/shared/project-types";
import {
  agentMessageFixture,
  projectStreamFixture,
} from "./project-message-streaming.fixtures";

class InMemoryProjectRepository implements ProjectRepository {
  constructor(private readonly project: Project) {}

  async saveProject(project: Project) {
    Object.assign(this.project, project);
    return this.project;
  }

  async getProject(id: string) {
    return this.project.id === id ? this.project : undefined;
  }

  async listProjects() {
    return [this.project];
  }

  async deleteProject() {
    return true;
  }

  async updateProjectProcessingState(
    id: string,
    processingStatus: Project["processingStatus"],
    _userId?: string,
    activeAgentMessageId?: string,
    processingStartedAt?: string,
  ) {
    if (this.project.id !== id) return undefined;
    this.project.processingStatus = processingStatus;
    this.project.activeAgentMessageId = activeAgentMessageId;
    this.project.processingStartedAt = processingStartedAt;
    this.project.updatedAt = new Date().toISOString();
    return this.project;
  }
}

class InMemoryMessageRepository implements ProjectMessageRepository {
  messages: Message[];
  chunks: AgentMessageChunk[] = [];

  constructor(seedMessages: Message[] = []) {
    this.messages = [...seedMessages];
  }

  async saveMessage(message: Message) {
    this.messages.push(message);
    return message;
  }

  async updateMessageStatus(id: string, status: Message["status"]) {
    const message = this.messages.find((item) => item.id === id);
    if (!message) return undefined;
    message.status = status;
    return message;
  }

  async updateMessageProcessingStatus(
    id: string,
    status: Message["processingStatus"],
  ) {
    const message = this.messages.find((item) => item.id === id);
    if (!message) return undefined;
    message.processingStatus = status;
    return message;
  }

  async updateMessage(id: string, updates: Partial<Message>) {
    const message = this.messages.find((item) => item.id === id);
    if (!message) return undefined;
    Object.assign(message, updates);
    return message;
  }

  async bulkUpdateMessageStatusByProject() {
    return 0;
  }

  async getMessage(projectId: string, messageId: string, _userId?: string) {
    return this.messages.find(
      (item) => item.projectId === projectId && item.id === messageId,
    );
  }

  async listMessages(_projectId: string, _userId?: string, cursor?: MessageCursor): Promise<MessagePage> {
    const limit = cursor?.limit ?? 100;
    return {
      messages: this.messages.slice(0, limit),
      total: this.messages.length,
    };
  }

  async saveAgentMessageChunk(chunk: AgentMessageChunk) {
    this.chunks.push(chunk);
    return chunk;
  }

  async listAgentMessageChunks(messageId: string) {
    return this.chunks.filter((chunk) => chunk.messageId === messageId);
  }
}

describe("MessageService", () => {
  it("creates user and pending agent messages and flips project processing on send", async () => {
    const projectRepository = new InMemoryProjectRepository({
      ...projectStreamFixture,
      processingStatus: "idle",
      activeAgentMessageId: undefined,
    });
    const messageRepository = new InMemoryMessageRepository();
    const service = new MessageService(
      projectRepository,
      messageRepository,
      () => ({}) satisfies AIProvider,
    );

    const result = await service.sendProjectMessage(
      projectStreamFixture.id,
      "Create a new hero section",
      projectStreamFixture.userId,
    );

    expect(result.userMessage.role).toBe("user");
    expect(result.userMessage.processingStatus).toBe("completed");
    expect(result.agentMessage.role).toBe("agent");
    expect(result.agentMessage.processingStatus).toBe("pending");
    expect(result.project.processingStatus).toBe("processing");
    expect(result.project.activeAgentMessageId).toBe(result.agentMessage.id);
    expect(result.stream.url).toContain(`/api/projects/${projectStreamFixture.id}/messages/`);
  });

  it("rejects sending while the project is already processing", async () => {
    const service = new MessageService(
      new InMemoryProjectRepository({ ...projectStreamFixture }),
      new InMemoryMessageRepository(),
      () => ({}) satisfies AIProvider,
    );

    await expect(
      service.sendProjectMessage(
        projectStreamFixture.id,
        "Try again",
        projectStreamFixture.userId,
      ),
    ).rejects.toThrow("already generating");
  });

  it("streams deltas, persists chunks, and completes the agent message", async () => {
    const userMessage: Message = {
      id: "user-message-1",
      userId: projectStreamFixture.userId,
      projectId: projectStreamFixture.id,
      role: "user",
      content: "Build a pricing page",
      status: "completed",
      processingStatus: "completed",
      createdAt: "2026-05-06T00:00:00.000Z",
      updatedAt: "2026-05-06T00:00:00.000Z",
    };
    const projectRepository = new InMemoryProjectRepository({ ...projectStreamFixture });
    const messageRepository = new InMemoryMessageRepository([
      userMessage,
      { ...agentMessageFixture, content: "" },
    ]);
    const emittedEvents: string[] = [];
    const provider: AIProvider = {
      async streamProjectMessage(_request, handlers) {
        await handlers.onStarted?.({
          type: "message.started",
          projectId: projectStreamFixture.id,
          messageId: agentMessageFixture.id,
          processingStatus: "streaming",
          providerResponseId: "resp_123",
        });
        await handlers.onDelta?.({
          type: "message.delta",
          messageId: agentMessageFixture.id,
          sequence: 1,
          delta: "Hello",
        });
        await handlers.onDelta?.({
          type: "message.delta",
          messageId: agentMessageFixture.id,
          sequence: 2,
          delta: " world",
        });
        await handlers.onCompleted?.({
          type: "message.completed",
          messageId: agentMessageFixture.id,
          content: "Hello world",
          processingStatus: "completed",
          projectProcessingStatus: "idle",
          providerResponseId: "resp_123",
        });
      },
    };
    const service = new MessageService(
      projectRepository,
      messageRepository,
      () => provider,
    );

    await service.streamProjectMessage(
      projectStreamFixture.id,
      agentMessageFixture.id,
      (event) => {
        emittedEvents.push(event.type);
      },
      undefined,
      projectStreamFixture.userId,
    );

    const finalMessage = await messageRepository.getMessage(
      projectStreamFixture.id,
      agentMessageFixture.id,
      projectStreamFixture.userId,
    );

    expect(emittedEvents).toEqual([
      "message.started",
      "message.delta",
      "message.delta",
      "message.completed",
    ]);
    expect(finalMessage?.content).toBe("Hello world");
    expect(finalMessage?.processingStatus).toBe("completed");
    expect(finalMessage?.providerResponseId).toBe("resp_123");
    expect(messageRepository.chunks).toHaveLength(2);
    expect(projectRepository["project"].processingStatus).toBe("idle");
  });

  it("stops generation and preserves partial content", async () => {
    const partialAgentMessage: Message = {
      ...agentMessageFixture,
      processingStatus: "streaming",
      content: "Partial draft",
    };
    const projectRepository = new InMemoryProjectRepository({ ...projectStreamFixture });
    const messageRepository = new InMemoryMessageRepository([partialAgentMessage]);
    const service = new MessageService(
      projectRepository,
      messageRepository,
      () => ({}) satisfies AIProvider,
    );

    const result = await service.stopProjectGeneration(
      projectStreamFixture.id,
      partialAgentMessage.id,
      projectStreamFixture.userId,
    );

    expect(result.project.processingStatus).toBe("idle");
    expect(result.agentMessage.processingStatus).toBe("stopped");
    expect(result.agentMessage.content).toBe("Partial draft");
  });

  it("stops generation even when the agent message is still empty", async () => {
    const pendingAgentMessage: Message = {
      ...agentMessageFixture,
      processingStatus: "pending",
      content: "",
    };
    const projectRepository = new InMemoryProjectRepository({ ...projectStreamFixture });
    const messageRepository = new InMemoryMessageRepository([pendingAgentMessage]);
    const service = new MessageService(
      projectRepository,
      messageRepository,
      () => ({}) satisfies AIProvider,
    );

    const result = await service.stopProjectGeneration(
      projectStreamFixture.id,
      pendingAgentMessage.id,
      projectStreamFixture.userId,
    );

    expect(result.project.processingStatus).toBe("idle");
    expect(result.agentMessage.processingStatus).toBe("stopped");
    expect(result.agentMessage.content).toBe("");
  });
});
