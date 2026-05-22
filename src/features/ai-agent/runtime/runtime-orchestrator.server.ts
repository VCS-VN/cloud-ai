import { execFile, type ChildProcess } from "node:child_process";
import axios from "axios";
import type { ProjectStateStore } from "@/features/ai-agent/project/project-state-store.server";
import type { DevRuntime } from "@/features/ai-agent/project/project-state.schema";
import type { Pm2Driver, PreviewPm2Process } from "./pm2-driver.server";
import type { CloudflareDnsClient, CloudflareDnsResult } from "./cloudflare-dns.server";
import { getPreviewRuntimeConfig } from "./preview-runtime-config.server";
import type { PortAllocator } from "./port-allocator.server";
import { getProjectWorkspaceRoot } from "@/server/config/paths.server";

export type RuntimeOrchestratorDeps = {
  projectStateStore: ProjectStateStore;
  pm2Driver: Pick<Pm2Driver, "describe" | "start"> & Partial<Pick<Pm2Driver, "delete">>;
  portAllocator: PortAllocator;
  runInstall?: (input: { projectId: string; workspaceRoot: string; signal?: AbortSignal }) => Promise<InstallRunResult>;
  healthCheck?: (url: string) => Promise<boolean>;
  createDnsClient?: (hostname: string) => Pick<CloudflareDnsClient, "deleteRecord" | "ensureRecord">;
  resolveWorkspaceRoot?: (projectId: string) => Promise<string> | string;
  now?: () => Date;
};

export type ScheduleEnsureRunningInput = {
  projectId: string;
  workspaceRoot: string;
  userId?: string;
  signal?: AbortSignal;
};

export type InstallRunResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
};

export type RuntimeStateResult = DevRuntime & {
  pm2: PreviewPm2Process;
};

export type StartPreviewRuntimeResult =
  | { success: true; previewUrl: string; previewHost: string | null; port: number; alreadyRunning?: boolean }
  | { success: false; error: string; errorTier: "code" | "config" | "system"; operatorAttentionRequired?: boolean };

export type TeardownPreviewRuntimeResult =
  | { success: true }
  | { success: false; error: string; operatorAttentionRequired: true };

export type EvictionCandidate = {
  projectId: string;
  userId?: string;
  lastAccessedAt: number;
};

const MAX_LOG_CHARS = 10000;
const INSTALL_TIMEOUT_MS = 120000;

export function buildPreviewHostname(projectId: string, publicHost: string | null) {
  return publicHost ? `${projectId}-preview.${publicHost}` : null;
}

function truncateLog(log: string | null | undefined) {
  if (!log) return null;
  return log.length > MAX_LOG_CHARS ? log.slice(-MAX_LOG_CHARS) : log;
}

export class RuntimeOrchestrator {
  private readonly scheduled = new Map<string, Promise<void>>();
  private readonly resuming = new Map<string, Promise<StartPreviewRuntimeResult>>();

  constructor(private readonly deps: RuntimeOrchestratorDeps) {}

  async getRuntimeState(projectId: string, userId?: string): Promise<RuntimeStateResult> {
    const runtime = await this.deps.projectStateStore.readDevRuntime(projectId, userId);
    const pm2 = await this.deps.pm2Driver.describe(projectId);
    const normalized = this.mergeLiveStatus(runtime, pm2);
    return { ...normalized, pm2 };
  }

  async touchLastAccessed(projectId: string, userId?: string): Promise<void> {
    const lastAccessedAt = (this.deps.now ?? (() => new Date()))().toISOString();
    await this.deps.projectStateStore.patchDevRuntime(projectId, { lastAccessedAt }, userId);
  }

  async resumePreview(projectId: string, userId?: string): Promise<StartPreviewRuntimeResult> {
    const inflight = this.resuming.get(projectId);
    if (inflight) return inflight;
    const task = this.runResume(projectId, userId).finally(() => {
      this.resuming.delete(projectId);
    });
    this.resuming.set(projectId, task);
    return task;
  }

  private async runResume(projectId: string, userId?: string): Promise<StartPreviewRuntimeResult> {
    const current = await this.getRuntimeState(projectId, userId);
    if (current.status === "running" && current.previewUrl && current.port) {
      return { success: true, alreadyRunning: true, previewUrl: current.previewUrl, previewHost: current.previewHost, port: current.port };
    }
    if (!current.enabled) {
      return { success: false, error: "Preview is disabled.", errorTier: "config" };
    }
    const workspaceRoot = await (this.deps.resolveWorkspaceRoot ?? getProjectWorkspaceRoot)(projectId);
    const config = getPreviewRuntimeConfig();
    await this.enforceConcurrencyCap(projectId, userId);
    const ensure = this.scheduleEnsureRunning({ projectId, workspaceRoot, userId });
    const timeoutMs = Math.max(1000, config.lazyResumeTimeoutSeconds * 1000);
    const timedOut = await waitWithTimeout(ensure, timeoutMs);
    const runtime = await this.getRuntimeState(projectId, userId);
    if (runtime.status === "running" && runtime.previewUrl && runtime.port) {
      return { success: true, previewUrl: runtime.previewUrl, previewHost: runtime.previewHost, port: runtime.port };
    }
    if (timedOut) {
      return { success: false, error: "Preview did not resume within the configured timeout.", errorTier: "system" };
    }
    return { success: false, error: runtime.lastError ?? "Preview did not resume.", errorTier: runtime.lastErrorTier ?? "system" };
  }

  async enforceConcurrencyCap(excludeProjectId?: string, userId?: string): Promise<EvictionCandidate[]> {
    const config = getPreviewRuntimeConfig();
    const cap = Math.max(1, config.maxConcurrentPreviews);
    const all = await this.deps.projectStateStore.listDevRuntimes();
    const running = all
      .filter((entry) => entry.projectId !== excludeProjectId && entry.devRuntime.status === "running")
      .map((entry) => ({
        projectId: entry.projectId,
        userId: entry.userId,
        lastAccessedAt: parseAccessTime(entry.devRuntime.lastAccessedAt),
      }))
      .sort((a, b) => a.lastAccessedAt - b.lastAccessedAt);
    const reservedSlot = excludeProjectId ? 1 : 0;
    const allowed = Math.max(0, cap - reservedSlot);
    const stopped: EvictionCandidate[] = [];
    while (running.length > allowed) {
      const victim = running.shift();
      if (!victim) break;
      await this.stopPreview(victim.projectId, victim.userId ?? userId);
      stopped.push(victim);
    }
    return stopped;
  }

  async stopPreview(projectId: string, userId?: string): Promise<void> {
    await this.deps.pm2Driver.delete?.(projectId);
    await this.deps.projectStateStore.patchDevRuntime(projectId, {
      status: "stopped",
      pid: null,
      lastError: null,
      lastErrorTier: null,
    }, userId);
  }

  async findIdleEligible(): Promise<EvictionCandidate[]> {
    const config = getPreviewRuntimeConfig();
    const idleThresholdMs = Math.max(0, config.idleTimeoutSeconds) * 1000;
    const now = (this.deps.now ?? (() => new Date()))().getTime();
    const all = await this.deps.projectStateStore.listDevRuntimes();
    const idle: EvictionCandidate[] = [];
    for (const entry of all) {
      if (entry.devRuntime.status !== "running") continue;
      const lastAccessedAt = parseAccessTime(entry.devRuntime.lastAccessedAt);
      if (now - lastAccessedAt < idleThresholdMs) continue;
      idle.push({ projectId: entry.projectId, userId: entry.userId, lastAccessedAt });
    }
    return idle;
  }

  async startPreview(input: ScheduleEnsureRunningInput): Promise<StartPreviewRuntimeResult> {
    const current = await this.getRuntimeState(input.projectId, input.userId);
    if (current.status === "running" && current.previewUrl && current.port) {
      return { success: true, alreadyRunning: true, previewUrl: current.previewUrl, previewHost: current.previewHost, port: current.port };
    }
    await this.enforceConcurrencyCap(input.projectId, input.userId);

    await this.scheduleEnsureRunning(input);
    const runtime = await this.deps.projectStateStore.readDevRuntime(input.projectId, input.userId);
    if (runtime.previewUrl && runtime.port) {
      return { success: true, previewUrl: runtime.previewUrl, previewHost: runtime.previewHost, port: runtime.port };
    }
    return { success: false, error: runtime.lastError ?? "Preview runtime is starting.", errorTier: runtime.lastErrorTier ?? "system" };
  }

  scheduleEnsureRunning(input: ScheduleEnsureRunningInput): Promise<void> {
    const existing = this.scheduled.get(input.projectId);
    if (existing) return existing;
    const task = this.ensureRunning(input).finally(() => {
      this.scheduled.delete(input.projectId);
    });
    this.scheduled.set(input.projectId, task);
    return task;
  }

  async teardownPreview(projectId: string, userId?: string): Promise<TeardownPreviewRuntimeResult> {
    const runtime = await this.deps.projectStateStore.readDevRuntime(projectId, userId);
    try {
      await this.deps.pm2Driver.delete?.(projectId);
      if (runtime.previewHost && this.deps.createDnsClient) {
        const dnsResult = await this.deps.createDnsClient(runtime.previewHost).deleteRecord(runtime.cloudflareDnsRecordId);
        if (!dnsResult.ok) throw new Error(dnsResult.error);
      }
      await this.deps.portAllocator.release(runtime.port);
      await this.deps.projectStateStore.patchDevRuntime(projectId, {
        enabled: false,
        status: "stopped",
        pid: null,
        port: null,
        previewUrl: null,
        previewHost: null,
        cloudflareDnsRecordId: null,
        dnsStatus: "none",
        lastError: null,
        lastErrorTier: null,
        operatorAttentionRequired: false,
      }, userId);
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Preview teardown failed.";
      await this.deps.projectStateStore.patchDevRuntime(projectId, {
        enabled: false,
        status: "error",
        lastError: truncateLog(message),
        lastErrorTier: "system",
        operatorAttentionRequired: true,
      }, userId);
      return { success: false, error: message, operatorAttentionRequired: true };
    }
  }

  private async ensureRunning(input: ScheduleEnsureRunningInput) {
    const runtime = await this.deps.projectStateStore.readDevRuntime(input.projectId, input.userId);
    const port = runtime.port ?? await this.deps.portAllocator.allocate({
      projectId: input.projectId,
      preferredPort: runtime.port,
      reservedPorts: new Set(),
    });
    const previewTarget = this.resolvePreviewTarget(input.projectId, port);
    const previewUrl = runtime.previewUrl ?? previewTarget.previewUrl;
    const installStartedAt = new Date().toISOString();
    await this.deps.projectStateStore.patchDevRuntime(input.projectId, {
      enabled: true,
      status: "installing",
      installStatus: "installing",
      port,
      previewUrl,
      previewHost: previewTarget.previewHost,
      dnsStatus: previewTarget.previewHost ? "creating" : "none",
      installStartedAt,
      installCompletedAt: null,
      lastError: null,
      lastErrorTier: null,
    }, input.userId);

    if (previewTarget.previewHost && this.deps.createDnsClient) {
      const dnsResult = await this.deps.createDnsClient(previewTarget.previewHost).ensureRecord();
      if (!dnsResult.ok) {
        await this.deps.projectStateStore.patchDevRuntime(input.projectId, {
          status: "error",
          dnsStatus: "error",
          lastError: dnsResult.error,
          lastErrorTier: "system",
          operatorAttentionRequired: dnsResult.operatorAttentionRequired,
        }, input.userId);
        return;
      }
      await this.deps.projectStateStore.patchDevRuntime(input.projectId, {
        cloudflareDnsRecordId: dnsResult.record.recordId,
        dnsStatus: "ready",
      }, input.userId);
    }

    try {
      const install = await (this.deps.runInstall ?? defaultRunInstall)({
        projectId: input.projectId,
        workspaceRoot: input.workspaceRoot,
        signal: input.signal,
      });
      await this.deps.projectStateStore.patchDevRuntime(input.projectId, {
        status: "installed",
        installStatus: "installed",
        installCompletedAt: new Date().toISOString(),
        installLog: truncateLog(`${install.stdout}\n${install.stderr}`),
      }, input.userId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Install failed.";
      await this.deps.projectStateStore.patchDevRuntime(input.projectId, {
        status: "error",
        installStatus: "failed",
        installLog: truncateLog(message),
        lastError: truncateLog(message),
        lastErrorTier: "system",
      }, input.userId);
      return;
    }

    await this.deps.projectStateStore.patchDevRuntime(input.projectId, {
      status: "starting",
      devStartedAt: new Date().toISOString(),
      lastError: null,
      lastErrorTier: null,
    }, input.userId);

    try {
      const process = await this.deps.pm2Driver.start({ projectId: input.projectId, workspaceRoot: input.workspaceRoot, port, previewHost: previewTarget.previewHost });
      const healthy = await (this.deps.healthCheck ?? defaultHealthCheck)(previewUrl);
      if (!healthy) {
        throw new Error("Preview process started but did not become healthy.");
      }
      await this.deps.projectStateStore.patchDevRuntime(input.projectId, {
        status: "running",
        pid: process.pid,
        port,
        previewUrl,
        lastAccessedAt: (this.deps.now ?? (() => new Date()))().toISOString(),
        lastError: null,
        lastErrorTier: null,
      }, input.userId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Preview did not become ready.";
      await this.deps.projectStateStore.patchDevRuntime(input.projectId, {
        status: "error",
        lastError: truncateLog(message),
        lastErrorTier: "system",
      }, input.userId);
    }
  }

  private resolvePreviewTarget(projectId: string, port: number) {
    const config = getPreviewRuntimeConfig();
    const previewHost = buildPreviewHostname(projectId, config.publicHost);
    return {
      previewHost,
      previewUrl: previewHost ? `https://${previewHost}` : `http://127.0.0.1:${port}`,
    };
  }

  private mergeLiveStatus(runtime: DevRuntime, pm2: PreviewPm2Process): DevRuntime {
    if (runtime.status === "running" && pm2.status !== "online") {
      return {
        ...runtime,
        status: pm2.status === "missing" ? "stopped" : "error",
        pid: null,
        lastError: pm2.status === "missing" ? "Preview process is not running." : "Preview process is not healthy.",
        lastErrorTier: "system",
      };
    }
    if (pm2.status === "online" && runtime.previewUrl && runtime.port) {
      return { ...runtime, status: "running", pid: pm2.pid };
    }
    return runtime;
  }
}

function defaultRunInstall(input: { workspaceRoot: string; signal?: AbortSignal }): Promise<InstallRunResult> {
  return new Promise((resolve, reject) => {
    let child: ChildProcess | null = null;
    const startedAt = Date.now();
    const abortHandler = () => {
      child?.kill("SIGTERM");
      reject(new Error("Install aborted."));
    };
    input.signal?.addEventListener("abort", abortHandler, { once: true });
    child = execFile("pnpm", ["install"], { cwd: input.workspaceRoot, timeout: INSTALL_TIMEOUT_MS, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      input.signal?.removeEventListener("abort", abortHandler);
      const durationMs = Date.now() - startedAt;
      if (error) {
        reject(new Error(`pnpm install failed: ${stderr || error.message}`));
        return;
      }
      resolve({ exitCode: 0, stdout, stderr, durationMs });
    });
  });
}

async function defaultHealthCheck(previewUrl: string) {
  try {
    const response = await axios.head(previewUrl, { validateStatus: () => true });
    return response.status >= 200 && response.status < 500;
  } catch {
    return false;
  }
}

function parseAccessTime(value: string | null | undefined): number {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

async function waitWithTimeout(task: Promise<unknown>, timeoutMs: number): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), timeoutMs);
  });
  try {
    const result = await Promise.race([
      task.then(() => "done" as const).catch(() => "done" as const),
      timeout,
    ]);
    return result === "timeout";
  } finally {
    if (timer) clearTimeout(timer);
  }
}
