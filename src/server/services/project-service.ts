import { ProjectWorkspaceService } from "@/agent/project-workspace-service";
import type { ProcessManager } from "@/features/runtime/legacy/process-manager.server";
import type { ProjectStateStore } from "@/features/projects/legacy/project-state-store.server";
import type { GeneratedProjectEnvWriter } from "@/features/ai-agent/store-runtime/generated-project-env-writer.server";
import { waitForPreviewHealthy } from "@/features/runtime/legacy/preview-health.server";
import {
  EMPTY_DEV_RUNTIME,
  type DevRuntime,
} from "@/features/projects/legacy/project-state.schema";
import type { RuntimeService } from "@/features/runtime/legacy/runtime-service.server";
import type { RuntimeOrchestrator } from "@/features/runtime/legacy/runtime-orchestrator.server";
import type { ProjectRunStore } from "@/features/projects/legacy/project-run-store.server";
import { reserveRunProducer } from "@/server/functions/project-message-stream";
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
  ProjectSettingsInput,
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

function normalizeProjectName(name?: string) {
  const normalized = name?.trim();
  if (name !== undefined && !normalized) throw new Error("Project name cannot be empty.");
  return normalized;
}

function normalizeSelectedStoreSlug(selectedStoreSlug?: string | null) {
  const normalized = selectedStoreSlug?.trim();
  return normalized ? normalized : null;
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

export type StartPreviewResult =
  | { success: true; previewUrl: string; port: number; alreadyRunning?: boolean }
  | { success: false; error: string; errorTier: "code" | "config" | "system" };

type PreviewReconcileResult =
  | { status: "ready"; previewUrl: string; port: number; alreadyRunning?: boolean }
  | { status: "start"; requestedPort?: number | null }
  | { status: "failed"; error: string; errorTier: "code" | "config" | "system" };

export class ProjectService {
  private readonly workspaceService: ProjectWorkspaceService;

  constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly messageRepository: ProjectMessageRepository,
    private readonly fileNodeRepository: ProjectFileNodeRepository,
    workspaceService?: ProjectWorkspaceService,
    private readonly processManager?: ProcessManager,
    private readonly projectStateStore?: ProjectStateStore,
    private readonly runtimeService?: RuntimeService,
    private readonly envWriter?: GeneratedProjectEnvWriter,
    private readonly runtimeOrchestrator?: RuntimeOrchestrator,
    private readonly runStore?: ProjectRunStore,
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

    const agentRun = this.runStore
      ? await this.runStore.create({
          projectId: project.id,
          userId,
          parentMessageId: userMessage.id,
          userPrompt: initialPrompt,
          status: "streaming",
        })
      : undefined;

    if (agentRun) reserveRunProducer(project.id, agentRun.id);

    const nextProject = await this.projectRepository.updateProjectProcessingState(
      project.id,
      "processing",
      userId,
      agentRun?.id,
      now,
    );

    // Kick off the codex builder run for this fresh project. Without this,
    // the run row stays "streaming" forever and the agent never produces code.
    if (agentRun) {
      console.log(
        JSON.stringify({
          event: "create_project_dispatch_starting",
          projectId: project.id,
          runId: agentRun.id,
          userId,
          promptLength: initialPrompt.length,
        }),
      );
      try {
        const { startBuilderRunForChat } = await import(
          "@/server/services/builder-run-dispatcher.server"
        );
        const dispatch = await startBuilderRunForChat({
          projectId: project.id,
          userId,
          prompt: initialPrompt,
          locale: "vi",
          project: { status: "draft" },
          runId: agentRun.id,
          parentMessageId: userMessage.id,
          persistence: this.runStore
            ? {
                messageRepository: this.messageRepository,
                projectRepository: this.projectRepository,
                runStore: this.runStore,
              }
            : undefined,
        });
        console.log(
          JSON.stringify({
            event: "create_project_dispatch_result",
            projectId: project.id,
            runId: agentRun.id,
            ok: dispatch.ok,
            code: dispatch.ok ? null : dispatch.code,
          }),
        );
        if (!dispatch.ok) {
          console.error(
            JSON.stringify({
              event: "create_project_dispatch_failed",
              projectId: project.id,
              runId: agentRun.id,
              code: dispatch.code,
              message: dispatch.message,
            }),
          );
        }
      } catch (error) {
        console.error(
          JSON.stringify({
            event: "create_project_dispatch_threw",
            projectId: project.id,
            runId: agentRun.id,
            error: error instanceof Error ? error.message : "unknown",
            stack: error instanceof Error ? error.stack : undefined,
          }),
        );
      }
    } else {
      console.warn(
        JSON.stringify({
          event: "create_project_no_run_store",
          projectId: project.id,
          message: "runStore is undefined; codex driver was NOT started",
        }),
      );
    }

    return {
      project:
        nextProject ?? {
          ...project,
          activeRunId: agentRun?.id,
          processingStartedAt: now,
        },
      messages: [userMessage],
      fileTree: [],
    };
  }

  async getProjectWorkspace(
    projectId: string,
    userId?: string,
  ): Promise<ProjectWorkspace | undefined> {
    const project = await this.projectRepository.getProject(projectId, userId);
    if (!project) return undefined;

    const [messages, fileTree, devRuntime] = await Promise.all([
      this.messageRepository.listMessages(projectId, userId, { limit: 50 }),
      this.fileNodeRepository.listFileNodes(projectId, userId),
      this.projectStateStore?.readDevRuntime(projectId) ?? null,
    ]);

    return {
      project,
      messages: messages.messages,
      fileTree: buildTree(fileTree),
      devRuntime: devRuntime ?? undefined,
    };
  }

  async updateProjectSettings(
    projectId: string,
    settings: ProjectSettingsInput,
    userId?: string,
  ): Promise<Project> {
    const previousStoreSlug = settings.selectedStoreSlug === undefined
      ? undefined
      : normalizeSelectedStoreSlug((await this.projectRepository.getProject(projectId, userId))?.selectedStoreSlug ?? null);
    const project = await this.projectRepository.updateProjectSettings(
      projectId,
      {
        name: normalizeProjectName(settings.name),
        selectedStoreSlug: normalizeSelectedStoreSlug(settings.selectedStoreSlug),
      },
      userId,
    );
    if (!project) throw new Error("Project not found.");
    if (settings.selectedStoreSlug !== undefined) {
      await this.envWriter
        ?.syncStoreSlug(projectId, project.selectedStoreSlug ?? null)
        .catch((err) =>
          console.warn(
            JSON.stringify({
              event: "generated_project_env_sync_failed",
              projectId,
              error: err instanceof Error ? err.message : String(err),
            }),
          ),
        );
      if (previousStoreSlug !== normalizeSelectedStoreSlug(project.selectedStoreSlug)) {
        void this.restartPreviewAfterStoreChange(projectId, userId);
      }
    }
    return project;
  }

  private async restartPreviewAfterStoreChange(projectId: string, userId?: string) {
    if (!this.runtimeOrchestrator) return;
    try {
      const workspaceRoot = await this.workspaceService.ensureWorkspace(projectId);
      await this.runtimeOrchestrator.restartPreview({ projectId, userId, workspaceRoot });
    } catch (err) {
      console.warn(
        JSON.stringify({
          event: "preview_restart_after_store_change_failed",
          projectId,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }

  async getDevRuntimeState(
    projectId: string,
    userId?: string,
  ): Promise<DevRuntime> {
    const project = await this.projectRepository.getProject(projectId, userId);
    if (!project) throw new Error("Project not found.");

    if (this.runtimeOrchestrator) {
      return this.runtimeOrchestrator.getRuntimeState(projectId, userId);
    }

    const runtime = await this.readReconciledDevRuntime(projectId, userId);

    return runtime;
  }

  async startPreview(
    projectId: string,
    userId?: string,
  ): Promise<StartPreviewResult> {
    const project = await this.projectRepository.getProject(projectId, userId);
    if (!project) throw new Error("Project not found.");
    const workspaceRoot = await this.workspaceService.ensureWorkspace(projectId);
    if (this.runtimeOrchestrator) {
      return this.runtimeOrchestrator.startPreview({ projectId, userId, workspaceRoot });
    }

    if (!this.processManager || !this.projectStateStore || !this.runtimeService) {
      return {
        success: false,
        error: "Preview runtime is not configured.",
        errorTier: "system",
      };
    }

    const currentRuntime = await this.projectStateStore.readDevRuntime(projectId, userId);
    const reconciled = await this.reconcilePreviewRuntime(projectId, currentRuntime, userId);
    if (reconciled.status === "ready") {
      return {
        success: true,
        alreadyRunning: reconciled.alreadyRunning,
        previewUrl: reconciled.previewUrl,
        port: reconciled.port,
      };
    }
    if (reconciled.status === "failed") {
      return {
        success: false,
        error: reconciled.error,
        errorTier: reconciled.errorTier,
      };
    }

    const runId = crypto.randomUUID();

    for await (const event of this.runtimeService.runPostInitDev({
      projectId,
      workspaceRoot,
      runId,
      requestedPort: reconciled.requestedPort,
    })) {
      if (event.type === "dev_ready") {
        return {
          success: true,
          previewUrl: event.previewUrl,
          port: event.port,
        };
      }
      if (event.type === "dev_error") {
        return {
          success: false,
          error: event.error,
          errorTier: event.tier,
        };
      }
    }

    const runtime = await this.projectStateStore.readDevRuntime(projectId, userId);
    if (runtime.status === "running" && runtime.previewUrl && runtime.port) {
      return {
        success: true,
        previewUrl: runtime.previewUrl,
        port: runtime.port,
      };
    }

    return {
      success: false,
      error: runtime.lastError ?? "Preview did not become ready.",
      errorTier: runtime.lastErrorTier ?? "system",
    };
  }

  private async readReconciledDevRuntime(
    projectId: string,
    userId?: string,
  ): Promise<DevRuntime> {
    const runtime =
      (await this.projectStateStore?.readDevRuntime(projectId, userId)) ??
      EMPTY_DEV_RUNTIME;
    if (!this.processManager || !this.projectStateStore) return runtime;

    const result = await this.reconcilePreviewRuntime(projectId, runtime, userId, {
      allowStart: false,
    });
    if (result.status === "failed") {
      return this.projectStateStore.readDevRuntime(projectId, userId);
    }
    return runtime;
  }

  private async reconcilePreviewRuntime(
    projectId: string,
    runtime: DevRuntime,
    userId?: string,
    options: { allowStart?: boolean } = {},
  ): Promise<PreviewReconcileResult> {
    if (!this.processManager || !this.projectStateStore) {
      return { status: "start" };
    }

    if (this.processManager.isRunning(projectId) && runtime.previewUrl && runtime.port) {
      return {
        status: "ready",
        alreadyRunning: true,
        previewUrl: runtime.previewUrl,
        port: runtime.port,
      };
    }

    if (runtime.status !== "running" || !runtime.port || !runtime.previewUrl) {
      return { status: "start" };
    }

    const portStatus = await this.processManager.getPortStatus(runtime.port);
    if (portStatus === "free") {
      if (options.allowStart === false) return runtime.port ? { status: "start", requestedPort: runtime.port } : { status: "start" };
      return { status: "start", requestedPort: runtime.port };
    }

    if (await this.isPreviewEndpointHealthy(runtime.previewUrl)) {
      return {
        status: "ready",
        alreadyRunning: true,
        previewUrl: runtime.previewUrl,
        port: runtime.port,
      };
    }

    await this.projectStateStore.saveDevRuntime(projectId, {
      ...runtime,
      status: "error",
      pid: null,
      lastError: "Recorded preview port is occupied by an unrelated or unhealthy process.",
      lastErrorTier: "system",
    }, userId);

    return {
      status: "failed",
      error: "Recorded preview port is occupied by an unrelated or unhealthy process.",
      errorTier: "system",
    };
  }

  private async isPreviewEndpointHealthy(previewUrl: string): Promise<boolean> {
    return waitForPreviewHealthy(previewUrl);
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

  async getSelectedStoreSlug(
    projectId: string,
    userId?: string,
  ): Promise<string | null> {
    const project = await this.projectRepository.getProject(projectId, userId);
    return normalizeSelectedStoreSlug(project?.selectedStoreSlug ?? null);
  }

  async deleteProject(
    projectId: string,
    userId?: string,
  ): Promise<{ success: true }> {
    if (this.runtimeOrchestrator) {
      const teardown = await this.runtimeOrchestrator.teardownPreview(projectId, userId);
      if (!teardown.success) throw new Error(teardown.error);
    } else {
      await this.processManager?.stop(projectId);
    }
    const deleted = await this.projectRepository.deleteProject(projectId, userId);
    if (!deleted) throw new Error("Project not found.");
    const deletedWorkspacePath = await this.workspaceService.deleteWorkspace(projectId);
    console.info(JSON.stringify({ event: "project_workspace_deleted", projectId, workspacePath: deletedWorkspacePath }));
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
