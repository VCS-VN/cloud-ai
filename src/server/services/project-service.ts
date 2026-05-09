import { ProjectWorkspaceService } from "@/agent/project-workspace-service";
import type {
  Project,
  ProjectFileNode,
  ProjectWorkspace,
  WorkspaceResult,
} from "@/shared/project-types";
import type {
  ProjectFileNodeRepository,
  ProjectMessageRepository,
  ProjectRepository,
} from "@/shared/project-types";

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
    : "New project";
}

function createDefaultPwaConfig(projectName: string, description?: string) {
  return {
    enabled: false,
    name: projectName,
    shortName: projectName.slice(0, 24) || "Project",
    description,
    themeColor: "#000000",
    backgroundColor: "#ffffff",
    display: "standalone" as const,
    startUrl: "/",
    scope: "/",
    offlineFallbackEnabled: false,
    icons: [],
  };
}

export class ProjectService {
  private readonly workspaceService: ProjectWorkspaceService;

  constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly messageRepository: ProjectMessageRepository,
    private readonly fileNodeRepository: ProjectFileNodeRepository,
    workspaceService?: ProjectWorkspaceService,
  ) {
    this.workspaceService = workspaceService ?? new ProjectWorkspaceService(fileNodeRepository);
  }

  async listProjects(userId?: string): Promise<Project[]> {
    return this.projectRepository.listProjects(userId);
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
      processingStatus: "processing",
      createdAt: now,
      updatedAt: now,
      pwa: createDefaultPwaConfig(projectName, initialPrompt),
    };

    await this.projectRepository.saveProject(project, userId);
    await this.workspaceService.ensureWorkspace(project.id);

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
        updatedAt: now,
      },
      userId,
    );

    const agentMessage = await this.messageRepository.saveMessage(
      {
        id: crypto.randomUUID(),
        userId,
        projectId: project.id,
        role: "agent",
        content: "",
        status: "pending",
        processingStatus: "pending",
        parentMessageId: userMessage.id,
        provider: "agent-orchestrator",
        createdAt: new Date(Date.parse(now) + 1).toISOString(),
        updatedAt: new Date(Date.parse(now) + 1).toISOString(),
      },
      userId,
    );

    const nextProject = await this.projectRepository.updateProjectProcessingState(
      project.id,
      "processing",
      userId,
      agentMessage.id,
      now,
    );

    return {
      project:
        nextProject ?? {
          ...project,
          activeAgentMessageId: agentMessage.id,
          processingStartedAt: now,
        },
      messages: [userMessage, agentMessage],
      fileTree: [],
    };
  }

  async getProjectWorkspace(
    projectId: string,
    userId?: string,
  ): Promise<ProjectWorkspace | undefined> {
    const project = await this.projectRepository.getProject(projectId, userId);
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

  async deleteProject(
    projectId: string,
    userId?: string,
  ): Promise<{ success: true }> {
    const deleted = await this.projectRepository.deleteProject(projectId, userId);
    if (!deleted) throw new Error("Project not found.");
    await this.workspaceService.deleteWorkspace(projectId);
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
