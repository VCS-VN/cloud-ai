import { describe, expect, it } from "vitest";
import { ProjectService } from "@/server/services/project-service";
import type {
  Message,
  Project,
  ProjectFileNode,
  ProjectFileNodeRepository,
  ProjectMessageRepository,
  ProjectRepository,
} from "@/shared/project-types";

class ProjectRepositoryStub implements ProjectRepository {
  savedProject?: Project;

  async saveProject(project: Project) {
    this.savedProject = project;
    return project;
  }

  async getProject() {
    return this.savedProject;
  }

  async listProjects() {
    return this.savedProject ? [this.savedProject] : [];
  }

  async deleteProject() {
    return true;
  }

  async updateProjectProcessingState(
    _id: string,
    processingStatus: Project["processingStatus"],
    _userId?: string,
    activeAgentMessageId?: string,
    processingStartedAt?: string,
  ) {
    if (!this.savedProject) return undefined;
    this.savedProject.processingStatus = processingStatus;
    this.savedProject.activeAgentMessageId = activeAgentMessageId;
    this.savedProject.processingStartedAt = processingStartedAt;
    return this.savedProject;
  }
}

class MessageRepositoryStub implements ProjectMessageRepository {
  messages: Message[] = [];

  async saveMessage(message: Message) {
    this.messages.push(message);
    return message;
  }

  async updateMessageStatus() {
    return undefined;
  }

  async updateMessageProcessingStatus() {
    return undefined;
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

  async getMessage(_projectId: string, _messageId: string, _userId?: string) {
    return undefined;
  }

  async listMessages() {
    return { messages: this.messages, total: this.messages.length };
  }

  async saveAgentMessageChunk(
    chunk: import("@/shared/project-types").AgentMessageChunk,
  ) {
    return chunk;
  }

  async listAgentMessageChunks() {
    return [];
  }
}

class FileNodeRepositoryStub implements ProjectFileNodeRepository {
  nodes: ProjectFileNode[] = [];

  async saveFileNode(node: ProjectFileNode) {
    const existingIndex = this.nodes.findIndex((item) => item.id === node.id);
    if (existingIndex >= 0) this.nodes[existingIndex] = node;
    else this.nodes.push(node);
    return node;
  }

  async getFileNode(_projectId?: string, nodeId?: string) {
    return this.nodes.find((node) => node.id === nodeId);
  }

  async listFileNodes() {
    return this.nodes;
  }
}

describe("ProjectService", () => {
  it("creates a project quickly and leaves the init agent message pending for SSE processing", async () => {
    const projectRepository = new ProjectRepositoryStub();
    const messageRepository = new MessageRepositoryStub();
    const service = new ProjectService(
      projectRepository,
      messageRepository,
      new FileNodeRepositoryStub(),
    );

    const workspace = await service.createProjectFromPrompt(
      "Build a project for outdoor gear with a bold hero and grid.",
      "user-1",
    );

    expect(workspace.project.processingStatus).toBe("processing");
    expect(workspace.project.activeAgentMessageId).toBeTruthy();
    expect(workspace.messages).toHaveLength(2);
    expect(workspace.messages[0]?.role).toBe("user");
    expect(workspace.messages[1]?.role).toBe("agent");
    expect(workspace.messages[1]?.processingStatus).toBe("pending");
    expect(workspace.messages[1]?.provider).toBe("workspace-agent");
    expect(workspace.messages[1]?.content).toBe("");
    expect(workspace.fileTree).toEqual([]);
  });
});
