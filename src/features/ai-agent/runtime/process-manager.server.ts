import { execFile, spawn, type ChildProcess } from "node:child_process";

export type DevProcessHandle = {
  projectId: string;
  pid: number;
  onStdout: (handler: (line: string) => void) => void;
  onStderr: (handler: (line: string) => void) => void;
  onExit: (handler: (code: number | null, signal: string | null) => void) => void;
  onError: (handler: (err: Error) => void) => void;
  kill: () => void;
};

export type InstallResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
};

const INSTALL_TIMEOUT_MS = 120_000;
const DEV_STOP_GRACE_MS = 5_000;

const VITE_READY_REGEX = /Local:\s+(https?:\/\/[^\s]+)/;

export function parseViteReady(line: string): { ready: boolean; url?: string; port?: number } {
  const match = line.match(VITE_READY_REGEX);
  if (!match) return { ready: false };
  const url = match[1];
  let port: number | undefined;
  try {
    port = new URL(url).port ? Number(new URL(url).port) : undefined;
  } catch {
    // ignore invalid URLs
  }
  return { ready: true, url, port };
}

export function parseViteError(line: string): { hasError: boolean; error?: string } {
  const trimmed = line.trim();
  if (!trimmed) return { hasError: false };

  if (
    /\berror TS\d+\b/.test(trimmed) ||
    /\bCannot find module\b/.test(trimmed) ||
    /\bdoes not provide an export\b/.test(trimmed) ||
    /\bUnexpected token\b/.test(trimmed) ||
    /\bParse failure\b/i.test(trimmed)
  ) {
    return { hasError: true, error: trimmed };
  }
  return { hasError: false };
}

export class ProcessManager {
  private processes = new Map<string, ChildProcess>();

  runInstall(
    projectId: string,
    workspaceRoot: string,
    signal?: AbortSignal,
  ): Promise<InstallResult> {
    return new Promise((resolve, reject) => {
      const startedAt = Date.now();

      const abortHandler = () => reject(new Error("Install aborted."));
      signal?.addEventListener("abort", abortHandler, { once: true });

      execFile(
        "pnpm",
        ["install"],
        {
          cwd: workspaceRoot,
          timeout: INSTALL_TIMEOUT_MS,
          maxBuffer: 10 * 1024 * 1024,
        },
        (error, stdout, stderr) => {
          signal?.removeEventListener("abort", abortHandler);
          const durationMs = Date.now() - startedAt;
          if (error) {
            reject(
              Object.assign(
                new Error(
                  `pnpm install failed with code ${(error as NodeJS.ErrnoException).code ?? "unknown"}: ${stderr || error.message}`,
                ),
                {
                  exitCode: (error as NodeJS.ErrnoException).code === "ERR_CHILD_PROCESS_TIMEOUT"
                    ? 124
                    : (error as { status?: number }).status ?? 1,
                  stdout,
                  stderr,
                  durationMs,
                },
              ),
            );
            return;
          }
          resolve({ exitCode: 0, stdout, stderr, durationMs });
        },
      );
    });
  }

  async startDevServer(
    projectId: string,
    workspaceRoot: string,
    signal?: AbortSignal,
  ): Promise<DevProcessHandle> {
    this.stop(projectId);

    const child = spawn("pnpm", ["dev"], {
      cwd: workspaceRoot,
      stdio: ["ignore", "pipe", "pipe"],
      detached: false,
    });

    this.processes.set(projectId, child);

    const stdoutHandlers: Array<(line: string) => void> = [];
    const stderrHandlers: Array<(line: string) => void> = [];
    const exitHandlers: Array<(code: number | null, signal: string | null) => void> = [];
    const errorHandlers: Array<(err: Error) => void> = [];

    let stdoutBuffer = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      stdoutBuffer += chunk.toString();
      const lines = stdoutBuffer.split("\n");
      stdoutBuffer = lines.pop() ?? "";
      for (const line of lines) {
        for (const handler of stdoutHandlers) handler(line);
      }
    });

    let stderrBuffer = "";
    child.stderr?.on("data", (chunk: Buffer) => {
      stderrBuffer += chunk.toString();
      const lines = stderrBuffer.split("\n");
      stderrBuffer = lines.pop() ?? "";
      for (const line of lines) {
        for (const handler of stderrHandlers) handler(line);
      }
    });

    child.on("exit", (code, sig) => {
      this.processes.delete(projectId);
      for (const handler of exitHandlers) handler(code, sig);
    });

    child.on("error", (err) => {
      this.processes.delete(projectId);
      for (const handler of errorHandlers) handler(err);
    });

    signal?.addEventListener("abort", () => this.stop(projectId), { once: true });

    return {
      projectId,
      pid: child.pid ?? -1,
      onStdout: (handler) => { stdoutHandlers.push(handler); },
      onStderr: (handler) => { stderrHandlers.push(handler); },
      onExit: (handler) => { exitHandlers.push(handler); },
      onError: (handler) => { errorHandlers.push(handler); },
      kill: () => this.stop(projectId),
    };
  }

  stop(projectId: string): Promise<void> {
    const child = this.processes.get(projectId);
    if (!child) return Promise.resolve();

    return new Promise((resolve) => {
      const killTimer = setTimeout(() => {
        if (child.exitCode === null) {
          child.kill("SIGKILL");
        }
        resolve();
      }, DEV_STOP_GRACE_MS);

      child.once("exit", () => {
        clearTimeout(killTimer);
        this.processes.delete(projectId);
        resolve();
      });

      child.kill("SIGTERM");
    });
  }

  isRunning(projectId: string): boolean {
    const child = this.processes.get(projectId);
    return child !== undefined && child.exitCode === null;
  }

  stopAll(): Promise<void> {
    const stops = Array.from(this.processes.keys()).map((id) => this.stop(id));
    return Promise.all(stops).then(() => {});
  }
}
