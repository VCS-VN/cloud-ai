import type { ProjectStateStore } from "@/features/ai-agent/project/project-state-store.server";
import type { DevRuntime } from "@/features/ai-agent/project/project-state.schema";
import type { Pm2Driver, PreviewPm2Process } from "./pm2-driver.server";

export type RuntimeReconcilerProject = {
  projectId: string;
  userId?: string;
  deleted?: boolean;
  devRuntime: DevRuntime;
};

export type RuntimeReconcilerDeps = {
  projectStateStore: ProjectStateStore;
  pm2Driver: Pick<Pm2Driver, "list" | "delete">;
  listProjects: () => Promise<RuntimeReconcilerProject[]>;
  now?: () => Date;
  installTimeoutMs?: number;
};

export type RuntimeReconcileResult = {
  cleanedProcesses: string[];
  failedInstalls: string[];
};

const DEFAULT_INSTALL_TIMEOUT_MS = 10 * 60 * 1000;

export class RuntimeReconciler {
  constructor(private readonly deps: RuntimeReconcilerDeps) {}

  async reconcile(): Promise<RuntimeReconcileResult> {
    const [projects, processes] = await Promise.all([
      this.deps.listProjects(),
      this.deps.pm2Driver.list(),
    ]);
    const projectById = new Map(projects.map((project) => [project.projectId, project]));
    const processByProjectId = new Map(processes.map((process) => [stripProcessPrefix(process.name), process]));
    const result: RuntimeReconcileResult = { cleanedProcesses: [], failedInstalls: [] };

    for (const process of processes) {
      const projectId = stripProcessPrefix(process.name);
      const project = projectById.get(projectId);
      if (!project || project.deleted || !project.devRuntime.enabled) {
        await this.deps.pm2Driver.delete(projectId);
        result.cleanedProcesses.push(projectId);
      }
    }

    for (const project of projects) {
      if (project.deleted) continue;
      const runtime = project.devRuntime;
      const process = processByProjectId.get(project.projectId);
      await this.reconcileRuntime(project, runtime, process, result);
    }

    return result;
  }

  private async reconcileRuntime(
    project: RuntimeReconcilerProject,
    runtime: DevRuntime,
    process: PreviewPm2Process | undefined,
    result: RuntimeReconcileResult,
  ) {
    if (this.isStuckInstall(runtime)) {
      await this.deps.projectStateStore.patchDevRuntime(project.projectId, {
        status: "error",
        installStatus: "failed",
        lastError: "Install timed out after application restart.",
        lastErrorTier: "system",
      }, project.userId);
      result.failedInstalls.push(project.projectId);
      return;
    }

    if (runtime.status === "running" && (!process || process.status !== "online")) {
      await this.deps.projectStateStore.patchDevRuntime(project.projectId, {
        status: process ? "error" : "stopped",
        pid: null,
        lastError: process ? "Preview process is not healthy." : "Preview process is not running.",
        lastErrorTier: "system",
      }, project.userId);
      return;
    }

    if (process?.status === "online" && runtime.status !== "running" && runtime.previewUrl && runtime.port) {
      await this.deps.projectStateStore.patchDevRuntime(project.projectId, {
        status: "running",
        pid: process.pid,
        lastError: null,
        lastErrorTier: null,
      }, project.userId);
    }
  }

  private isStuckInstall(runtime: DevRuntime) {
    if (runtime.installStatus !== "installing" || !runtime.installStartedAt) return false;
    const startedAt = new Date(runtime.installStartedAt).getTime();
    if (!Number.isFinite(startedAt)) return false;
    const now = (this.deps.now ?? (() => new Date()))().getTime();
    return now - startedAt > (this.deps.installTimeoutMs ?? DEFAULT_INSTALL_TIMEOUT_MS);
  }
}

function stripProcessPrefix(name: string) {
  return name.startsWith("proj-") ? name.slice(5) : name;
}
