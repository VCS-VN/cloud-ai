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
import type { RuntimeOrchestrator, PreviewStatus } from "@/features/runtime/legacy/runtime-orchestrator.server";
import type { ProjectRunStore } from "@/features/projects/legacy/project-run-store.server";
import type { PgAgentRunRepository } from "@/server/repositories/agent-run-repository";
import type { DevStoppedEvent } from "@/features/runtime/legacy/runtime-events";
import {
  publishRuntimeEvent,
  reserveRunProducer,
  scheduleDelayedRuntimeEvent,
} from "@/server/functions/project-message-stream";
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
  RunnerMessageRepository,
} from "@/shared/project-types";

/**
 * Delay (ms) before publishing a runtime event after preview spawn/stop
 * succeeds. PM2 needs time to settle after `pm2 start`/`pm2 stop` before
 * the process status is reliably queryable, so we wait before notifying
 * subscribers. The client polls the runtime state endpoint every 3s as a
 * fallback (see project detail route), so the event is an optimization.
 */
const PREVIEW_EVENT_SETTLE_DELAY_MS = 5000;

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

export type CreateProjectFromPromptResult =
  | { ok: true; workspace: ProjectWorkspace }
  | { ok: false; code: "episcloud_not_activated"; message: string };

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
    private readonly agentRunRepository?: PgAgentRunRepository,
    private readonly runnerMessageRepository?: RunnerMessageRepository,
  ) {
    this.workspaceService = workspaceService ?? new ProjectWorkspaceService(fileNodeRepository);
  }

  async listProjects(userId?: string): Promise<Project[]> {
    const projects = await this.projectRepository.listProjects(userId);
    if (!this.runtimeOrchestrator || projects.length === 0) return projects;
    // Enrich each project with preview status derived from the live PM2
    // process list (source of truth) via a single batched call.
    const statusMap = await this.runtimeOrchestrator.getPreviewStatusMap(
      projects.map((p) => p.id),
    );
    return projects.map((p) => ({
      ...p,
      previewStatus: statusMap[p.id] ?? 'stopped',
    }));
  }

  async createProjectFromPrompt(
    prompt: string,
    userId?: string,
    model?: string,
  ): Promise<CreateProjectFromPromptResult> {
    const initialPrompt = assertPrompt(prompt);

    // Block BEFORE creating the project row when the user hasn't activated Epis
    // Cloud — the codex init build authenticates against the user's Epis Cloud
    // key. Checking here (not just inside the dispatcher) avoids leaving an
    // orphaned project + message + run row stuck "processing".
    const { getAuthService } = await import("@/auth/auth-service");
    const episCloudApiKey = userId
      ? await getAuthService().getEpisCloudApiKeyForUserId(userId)
      : null;
    if (!episCloudApiKey) {
      return {
        ok: false,
        code: "episcloud_not_activated",
        message: "Activate EpisCloud to run AI builds on your account.",
      };
    }

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
    await this.envWriter
      ?.ensureDefaultEnv(project.id, project.selectedStoreSlug ?? null)
      .catch((err) =>
        console.warn(
          JSON.stringify({
            event: "generated_project_env_create_failed",
            projectId: project.id,
            error: err instanceof Error ? err.message : String(err),
          }),
        ),
      );

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
          model,
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
          model,
          project: { status: "draft" },
          runId: agentRun.id,
          parentMessageId: userMessage.id,
          persistence: this.runStore
            ? {
                messageRepository: this.messageRepository,
                projectRepository: this.projectRepository,
                runStore: this.runStore,
                agentRunRepository: this.agentRunRepository,
                runnerMessageRepository: this.runnerMessageRepository,
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
      ok: true,
      workspace: {
        project:
          nextProject ?? {
            ...project,
            activeRunId: agentRun?.id,
            processingStartedAt: now,
          },
        messages: [userMessage],
        fileTree: [],
      },
    };
  }

  async getProjectWorkspace(
    projectId: string,
    userId?: string,
  ): Promise<ProjectWorkspace | undefined> {
    const project = await this.projectRepository.getProject(projectId, userId);
    if (!project) return undefined;

    const [messages, fileTree, devRuntime, projectState] = await Promise.all([
      this.messageRepository.listMessages(projectId, userId, { limit: 50 }),
      this.fileNodeRepository.listFileNodes(projectId, userId),
      this.projectStateStore?.readDevRuntime(projectId) ?? null,
      this.projectStateStore?.loadOrCreate(projectId, userId) ?? null,
    ]);

    return {
      project: {
        ...project,
        generatedPages: projectState?.generatedPages ?? [],
      },
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
      let envSynced = false;
      if (this.envWriter) {
        try {
          await this.envWriter.syncStoreSlug(
            projectId,
            project.selectedStoreSlug ?? null,
          );
          envSynced = true;
        } catch (err) {
          console.warn(
            JSON.stringify({
              event: "generated_project_env_sync_failed",
              projectId,
              error: err instanceof Error ? err.message : String(err),
            }),
          );
        }
      }
      if (
        envSynced &&
        previousStoreSlug !== normalizeSelectedStoreSlug(project.selectedStoreSlug)
      ) {
        publishRuntimeEvent(projectId, {
          type: "preview_reload_requested",
          projectId,
          reason: "store_slug_synced",
          delayMs: 5000,
          at: new Date().toISOString(),
        });
        // Vite resolves `import.meta.env.VITE_STORE_SLUG` at dev server start
        // and does NOT re-read .env on iframe reload. Restart the PM2 preview
        // process so the new slug is picked up; without this, the generated
        // hooks keep returning sample data despite the .env update.
        if (this.runtimeOrchestrator) {
          const workspaceRoot = await this.workspaceService.ensureWorkspace(projectId);
          this.runtimeOrchestrator
            .restartPreview({ projectId, userId, workspaceRoot })
            .catch((err) => {
              console.warn(
                JSON.stringify({
                  event: "generated_project_preview_restart_failed",
                  projectId,
                  error: err instanceof Error ? err.message : String(err),
                }),
              );
            });
        }
      }
    }
    return project;
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
      const runId = crypto.randomUUID();
      publishRuntimeEvent(projectId, { type: "dev_starting", projectId, runId });
      const result = await this.runtimeOrchestrator.startPreview({
        projectId,
        userId,
        workspaceRoot,
      });
      if (result.success) {
        // Wait for the PM2 process to settle before notifying subscribers.
        // The client polls the runtime state endpoint every 3s as a fallback,
        // so this delayed event is an optimization to reduce the window in
        // which the UI shows a stale status.
        scheduleDelayedRuntimeEvent(
          projectId,
          {
            type: "dev_ready",
            projectId,
            runId,
            previewUrl: result.previewUrl,
            port: result.port,
          },
          PREVIEW_EVENT_SETTLE_DELAY_MS,
        );
      } else {
        publishRuntimeEvent(projectId, {
          type: "dev_error",
          projectId,
          runId,
          error: result.error,
          tier: result.errorTier,
        });
      }
      return result;
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
      publishRuntimeEvent(projectId, event);
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

  async stopPreview(
    projectId: string,
    userId?: string,
  ) {
    if (this.runtimeOrchestrator) {
      const result = await this.runtimeOrchestrator.stopPreview(projectId, userId);
      if (result.success) {
        scheduleDelayedRuntimeEvent(
          projectId,
          { type: "dev_stopped", projectId } as DevStoppedEvent,
          PREVIEW_EVENT_SETTLE_DELAY_MS,
        );
      }
      return result;
    }
    let stopError: unknown = null;
    try {
      await this.processManager?.stop(projectId);
    } catch (error) {
      stopError = error;
    }
    try {
      await this.projectStateStore?.patchDevRuntime(projectId, {
        status: "stopped",
        pid: null,
        lastError: null,
        lastErrorTier: null,
      }, userId);
    } catch (error) {
      const stopMessage = stopError instanceof Error ? stopError.message : null;
      const dbMessage = error instanceof Error ? error.message : "Preview database update failed.";
      return {
        success: false as const,
        error: stopMessage ? `${stopMessage}; ${dbMessage}` : dbMessage,
        pm2StopAttempted: true as const,
        databaseUpdateAttempted: true as const,
      };
    }
    if (stopError) {
      return {
        success: false as const,
        error: stopError instanceof Error ? stopError.message : "Preview process stop failed.",
        pm2StopAttempted: true as const,
        databaseUpdateAttempted: true as const,
      };
    }
    scheduleDelayedRuntimeEvent(
      projectId,
      { type: "dev_stopped", projectId } as DevStoppedEvent,
      PREVIEW_EVENT_SETTLE_DELAY_MS,
    );
    return { success: true as const };
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
