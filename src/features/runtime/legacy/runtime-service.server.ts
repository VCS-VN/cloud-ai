import { parseViteReady, parseViteError, type ProcessManager } from "./process-manager.server";
import type { ProjectStateStore } from "@/features/projects/legacy/project-state-store.server";
import { EMPTY_DEV_RUNTIME, type DevRuntime } from "@/features/projects/legacy/project-state.schema";
import type { DevRuntimeEvent } from "./runtime-events";
import { ErrorAnalyzer, ErrorFixer } from "./error-analyzer.server";
import { waitForPreviewHealthy } from "./preview-health.server";

export type RuntimeServiceDeps = {
  processManager: ProcessManager;
  projectStateStore: ProjectStateStore;
  errorFixer: ErrorFixer;
};

const MAX_LOG_CHARS = 10000;
const DEV_READY_TIMEOUT_MS = 30_000;

function truncateLog(log: string | null): string | null {
  if (!log) return log;
  return log.length > MAX_LOG_CHARS ? log.slice(-MAX_LOG_CHARS) : log;
}

function detectErrorTier(error: string): "code" | "config" | "system" {
  return new ErrorAnalyzer().analyze(error).tier;
}

export class RuntimeService {
  constructor(private readonly deps: RuntimeServiceDeps) {}

  async *runPostInitInstall(input: {
    projectId: string;
    workspaceRoot: string;
    runId: string;
    signal?: AbortSignal;
  }): AsyncGenerator<DevRuntimeEvent> {
    const { projectId, workspaceRoot, runId, signal } = input;

    const installStartedAt = new Date().toISOString();
    const updatedRuntime: DevRuntime = {
      ...EMPTY_DEV_RUNTIME,
      status: "installing",
      installStartedAt,
    };
    await this.deps.projectStateStore.saveDevRuntime(projectId, updatedRuntime);

    yield {
      type: "dev_install_started",
      runId,
      projectId,
    };

    try {
      const result = await this.deps.processManager.runInstall(
        projectId,
        workspaceRoot,
        signal,
      );

      const installedRuntime: DevRuntime = {
        ...EMPTY_DEV_RUNTIME,
        status: "installed",
        installStartedAt,
        installCompletedAt: new Date().toISOString(),
        installLog: truncateLog(`${result.stdout}\n${result.stderr}`),
      };
      await this.deps.projectStateStore.saveDevRuntime(projectId, installedRuntime);

      yield {
        type: "dev_install_completed",
        runId,
        projectId,
        durationMs: result.durationMs,
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Unknown install error";
      const errStderr = (error as { stderr?: string }).stderr ?? "";

      const errorRuntime: DevRuntime = {
        ...EMPTY_DEV_RUNTIME,
        status: "error",
        installStartedAt,
        installLog: truncateLog(errStderr || errMsg),
        lastError: truncateLog(errMsg) ?? errMsg.slice(0, MAX_LOG_CHARS),
        lastErrorTier: "system",
      };
      await this.deps.projectStateStore.saveDevRuntime(projectId, errorRuntime);

      yield {
        type: "dev_install_failed",
        runId,
        projectId,
        error: errMsg,
        tier: "system",
      };
    }
  }

  async *runPostInitDev(input: {
    projectId: string;
    workspaceRoot: string;
    runId: string;
    signal?: AbortSignal;
    requestedPort?: number | null;
  }): AsyncGenerator<DevRuntimeEvent> {
    const { projectId, workspaceRoot, runId, signal } = input;
    let requestedPort = input.requestedPort;

    const currentRuntime = await this.deps.projectStateStore.readDevRuntime(projectId);
    if (
      currentRuntime.status === "running" &&
      currentRuntime.previewUrl &&
      currentRuntime.port &&
      this.deps.processManager.isRunning(projectId)
    ) {
      yield {
        type: "dev_ready",
        runId,
        projectId,
        previewUrl: currentRuntime.previewUrl,
        port: currentRuntime.port,
      };
      return;
    }

    if (
      currentRuntime.status === "running" &&
      currentRuntime.port &&
      !this.deps.processManager.isRunning(projectId) &&
      !requestedPort
    ) {
      const portStatus = await this.deps.processManager.getPortStatus(currentRuntime.port);
      if (portStatus === "free") {
        requestedPort = currentRuntime.port;
      } else if (currentRuntime.previewUrl && await this.isPreviewEndpointHealthy(currentRuntime.previewUrl)) {
        yield {
          type: "dev_ready",
          runId,
          projectId,
          previewUrl: currentRuntime.previewUrl,
          port: currentRuntime.port,
        };
        return;
      } else {
        const errorRuntime: DevRuntime = {
          ...currentRuntime,
          status: "error",
          pid: null,
          lastError: "Recorded preview port is occupied by an unrelated or unhealthy process.",
          lastErrorTier: "system",
        };
        await this.deps.projectStateStore.saveDevRuntime(projectId, errorRuntime);
        yield {
          type: "dev_error",
          runId,
          projectId,
          error: errorRuntime.lastError ?? "Preview did not become ready.",
          tier: "system",
        };
        return;
      }
    }
    const devStartedAt = new Date().toISOString();
    const startingRuntime: DevRuntime = {
      ...currentRuntime,
      status: "starting",
      devStartedAt,
    };
    await this.deps.projectStateStore.saveDevRuntime(projectId, startingRuntime);

    yield {
      type: "dev_starting",
      runId,
      projectId,
    };

    const handle = await this.deps.processManager.startDevServer(
      projectId,
      workspaceRoot,
      signal,
      requestedPort,
    );

    const devLogLines: string[] = [];
    let readyUrl: string | null = null;
    let readyPort: number | null = null;
    let devError: string | null = null;

    handle.onStdout((line) => {
      const viteParse = parseViteReady(line);
      if (viteParse.ready && viteParse.url) {
        readyUrl = viteParse.url;
        readyPort = viteParse.port ?? 5173;
      }
      devLogLines.push(line);
    });

    handle.onStderr((line) => {
      const viteErr = parseViteError(line);
      if (viteErr.hasError && viteErr.error) {
        devError = viteErr.error;
      }
      devLogLines.push(line);
    });

    const outcome = await new Promise<"ready" | "error">((resolve) => {
      const timeout = setTimeout(() => {
        devError = devError ?? "Dev server startup timed out after 30 seconds.";
        resolve("error");
      }, DEV_READY_TIMEOUT_MS);

      handle.onExit((code) => {
        clearTimeout(timeout);
        if (!readyUrl) {
          devError = devError ?? `Dev server exited with code ${code} before ready.`;
        }
        resolve("error");
      });

      handle.onError((err) => {
        clearTimeout(timeout);
        devError = err.message;
        resolve("error");
      });

      const checkInterval = setInterval(() => {
        if (readyUrl) {
          clearTimeout(timeout);
          clearInterval(checkInterval);
          resolve("ready");
        }
      }, 100);
    });

    const devLog = truncateLog(devLogLines.join("\n"));

    const healthy = outcome === "ready" && readyUrl
      ? await this.isPreviewEndpointHealthy(readyUrl)
      : false;

    if (healthy && readyUrl) {
      const runningRuntime: DevRuntime = {
        ...currentRuntime,
        status: "running",
        pid: handle.pid,
        port: readyPort ?? 5173,
        previewUrl: readyUrl,
        devStartedAt,
        devLog,
      };
      await this.deps.projectStateStore.saveDevRuntime(projectId, runningRuntime);

      yield {
        type: "dev_ready",
        runId,
        projectId,
        previewUrl: readyUrl,
        port: readyPort ?? 5173,
      };
    } else {
      if (outcome === "ready" && readyUrl) {
        devError = "Preview process started but did not become healthy.";
      }
      const errorRuntime: DevRuntime = {
        ...currentRuntime,
        status: "error",
        pid: handle.pid,
        devStartedAt,
        devLog,
        lastError: truncateLog(devError),
        lastErrorTier: devError ? detectErrorTier(devError) : null,
      };
      await this.deps.projectStateStore.saveDevRuntime(projectId, errorRuntime);

      yield {
        type: "dev_error",
        runId,
        projectId,
        error: devError ?? "Unknown dev server error.",
        tier: devError ? detectErrorTier(devError) : "system",
      };
    }
  }

  private async isPreviewEndpointHealthy(previewUrl: string): Promise<boolean> {
    return waitForPreviewHealthy(previewUrl);
  }

  async *runErrorFixLoop(input: {
    projectId: string;
    workspaceRoot: string;
    runId: string;
    currentDevLog: string;
    signal?: AbortSignal;
  }): AsyncGenerator<DevRuntimeEvent> {
    const { projectId, workspaceRoot, runId, currentDevLog, signal } = input;
    const analyzer = new ErrorAnalyzer();
    const runtime = await this.deps.projectStateStore.readDevRuntime(projectId);
    const fixAttempts = [...runtime.fixAttempts];

    let devLog = currentDevLog;
    let retryCount = runtime.retryCount;

    while (retryCount < 3) {
      const analysis = analyzer.analyze(devLog);

      if (!analyzer.isFixable(analysis)) {
        yield {
          type: "dev_fix_failed",
          runId,
          projectId,
          reason: `Unfixable system error: ${analysis.summary}`,
        };
        return;
      }

      const attempt = retryCount + 1;
      const errorBefore = devLog.slice(-500);

      yield {
        type: "dev_fix_attempt",
        runId,
        projectId,
        attempt,
        error: analysis.summary,
      };

      const fixResult = await this.deps.errorFixer.attemptFix({
        projectId,
        workspaceRoot,
        analysis,
      });

      retryCount++;
      fixAttempts.push({
        attempt,
        changedFiles: fixResult.changedFiles,
        errorBefore,
        errorAfter: null,
        success: fixResult.success,
      });

      if (!fixResult.success) {
        await this.deps.projectStateStore.saveDevRuntime(projectId, {
          ...runtime,
          retryCount,
          fixAttempts,
        });

        yield {
          type: "dev_fix_failed",
          runId,
          projectId,
          reason: fixResult.summary,
        };
        continue;
      }

      yield {
        type: "dev_fix_applied",
        runId,
        projectId,
        attempt,
        changedFiles: fixResult.changedFiles,
      };

      await this.deps.processManager.stop(projectId);

      const startingRuntime: DevRuntime = {
        ...runtime,
        status: "starting",
        devStartedAt: new Date().toISOString(),
        fixAttempts,
        retryCount,
      };
      await this.deps.projectStateStore.saveDevRuntime(projectId, startingRuntime);

      yield {
        type: "dev_starting",
        runId,
        projectId,
      };

      const devGenerator = this.runPostInitDev({ projectId, workspaceRoot, runId, signal });
      let devSucceeded = false;

      for await (const event of devGenerator) {
        if (event.type === "dev_ready") {
          devSucceeded = true;
        }
        if (event.type === "dev_error" && event.tier !== "system") {
          devLog = event.error;
        }
        yield event;
      }

      if (devSucceeded) {
        return;
      }
    }

    await this.deps.projectStateStore.saveDevRuntime(projectId, {
      ...runtime,
      status: "error",
      retryCount,
      fixAttempts,
      lastError: "Max retries (3) reached.",
      lastErrorTier: "system",
    });

    yield {
      type: "dev_fix_failed",
      runId,
      projectId,
      reason: "Max retries (3) reached without successful fix.",
    };
  }
}
