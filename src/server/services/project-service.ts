import type {
  Project,
  ProjectFileNode,
  ProjectWorkspace,
  WorkspaceResult,
} from "@/shared/storefront-builder-types";
import { createDefaultPwaConfig, createSeedFileTree } from "./mock-store";
import { initializeChatGptProvider } from "@/ai/ai-provider";
import type {
  ProjectFileNodeRepository,
  ProjectMessageRepository,
  StorefrontBuilderProjectRepository,
} from "@/shared/storefront-builder-types";

function assertPrompt(prompt: string) {
  const trimmed = prompt.trim();
  if (!trimmed) throw new Error("Prompt cannot be empty.");
  return trimmed;
}

function deriveProjectName(prompt: string) {
  const words = prompt
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 7)
    .join(" ");
  return words
    ? `${words}${prompt.split(/\s+/).length > 7 ? "..." : ""}`
    : "New storefront";
}

export class StorefrontBuilderProjectService {
  constructor(
    private readonly projectRepository: StorefrontBuilderProjectRepository,
    private readonly messageRepository: ProjectMessageRepository,
    private readonly fileNodeRepository: ProjectFileNodeRepository,
  ) {}

  async listProjects(userId?: string): Promise<Project[]> {
    return this.projectRepository.listBuilderProjects(userId);
  }

  async createProjectFromPrompt(
    prompt: string,
    userId?: string,
  ): Promise<ProjectWorkspace> {
    const initialPrompt = assertPrompt(prompt);
    const now = new Date().toISOString();
    const projectName = deriveProjectName(initialPrompt);

    const project: Project = {
      id: crypto.randomUUID(),
      name: projectName,
      description:
        initialPrompt.length > 140
          ? `${initialPrompt.slice(0, 137)}...`
          : initialPrompt,
      initialPrompt,
      status: "ready",
      createdAt: now,
      updatedAt: now,
      pwa: createDefaultPwaConfig(projectName, initialPrompt),
    };

    await this.projectRepository.saveBuilderProject(project, userId);

    const userMessage = await this.messageRepository.saveMessage(
      {
        id: crypto.randomUUID(),
        userId,
        projectId: project.id,
        role: "user",
        content: initialPrompt,
        status: "completed",
        processingStatus: "completed",
        createdAt: now,
      },
      userId,
    );

    const providerInit = initializeChatGptProvider();
    const agentProcessingStatus =
      providerInit.status === "configured" ? "completed" : "failed";
    const agentContent =
      agentProcessingStatus === "completed"
        ? "I created the initial storefront workspace with a virtual file structure and default PWA settings so you can continue refining it."
        : "The workspace was created, but ChatGPT processing is waiting for provider configuration. You can retry this message once the configuration is ready.";

    const agentMessage = await this.messageRepository.saveMessage(
      {
        id: crypto.randomUUID(),
        userId,
        projectId: project.id,
        role: "agent",
        content: agentContent,
        status: "completed",
        processingStatus: agentProcessingStatus,
        createdAt: new Date(Date.parse(now) + 1).toISOString(),
      },
      userId,
    );

    const fileTree = await this.saveInitialFileTree(project, userId);

    return { project, messages: [userMessage, agentMessage], fileTree };
  }

  async getProjectWorkspace(
    projectId: string,
    userId?: string,
  ): Promise<ProjectWorkspace | undefined> {
    const project = await this.projectRepository.getBuilderProject(
      projectId,
      userId,
    );
    if (!project) return undefined;

    const [messages, fileTree] = await Promise.all([
      this.messageRepository.listMessages(projectId, userId, { limit: 50 }),
      this.fileNodeRepository.listFileNodes(projectId, userId),
    ]);

    return {
      project,
      messages: messages.messages,
      fileTree: buildTree(fileTree),
    };
  }

  async getWorkspace(
    selectedProjectId?: string,
    userId?: string,
  ): Promise<WorkspaceResult> {
    const projects = await this.listProjects(userId);
    const projectId = selectedProjectId ?? projects[0]?.id;
    const workspace = projectId
      ? await this.getProjectWorkspace(projectId, userId)
      : undefined;
    return { projects, selectedProjectId: workspace?.project.id, workspace };
  }

  private async saveInitialFileTree(
    project: Project,
    userId?: string,
  ): Promise<ProjectFileNode[]> {
    const nodes = createSeedFileTree(project);
    const saved = [];
    for (const node of nodes) {
      saved.push(
        await this.fileNodeRepository.saveFileNode({ ...node, userId }, userId),
      );
    }
    return buildTree(saved);
  }

  async deleteProject(
    projectId: string,
    userId?: string,
  ): Promise<{ success: true }> {
    const deleted = await this.projectRepository.deleteBuilderProject(
      projectId,
      userId,
    );
    if (!deleted) throw new Error("Project not found.");
    await this.messageRepository.bulkUpdateMessageStatusByProject(
      projectId,
      0,
      userId,
    );
    return { success: true };
  }
}

export function buildTree(nodes: ProjectFileNode[]): ProjectFileNode[] {
  const byId = new Map(
    nodes.map((node) => [
      node.id,
      { ...node, children: [] as ProjectFileNode[] },
    ]),
  );
  const roots: ProjectFileNode[] = [];

  for (const node of byId.values()) {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId)?.children?.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortNodes = (items: ProjectFileNode[]) => {
    items.sort((left, right) => {
      if (left.type !== right.type) return left.type === "folder" ? -1 : 1;
      return left.name.localeCompare(right.name);
    });
    items.forEach((item) => item.children && sortNodes(item.children));
  };

  sortNodes(roots);
  return roots;
}
