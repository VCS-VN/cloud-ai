import { execFile, spawn, type ChildProcess } from "node:child_process";
import net from "node:net";

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

export type PortStatus = "free" | "occupied";

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

function runPnpm(args: string[], workspaceRoot: string, signal?: AbortSignal): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    let child: ChildProcess | null = null;
    const abortHandler = () => {
      child?.kill("SIGTERM");
      reject(new Error("Install aborted."));
    };
    signal?.addEventListener("abort", abortHandler, { once: true });
    child = execFile(
      "pnpm",
      args,
      {
        cwd: workspaceRoot,
        timeout: INSTALL_TIMEOUT_MS,
        maxBuffer: 10 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        signal?.removeEventListener("abort", abortHandler);
        if (error) {
          reject(Object.assign(new Error(`pnpm ${args.join(" ")} failed: ${stderr || error.message}`), { stdout, stderr }));
          return;
        }
        resolve({ stdout, stderr });
      },
    );
  });
}

export class ProcessManager {
  private processes = new Map<string, ChildProcess>();

  async getPortStatus(port: number): Promise<PortStatus> {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.once("error", () => resolve("occupied"));
      server.once("listening", () => {
        server.close(() => resolve("free"));
      });
      server.listen(port, "127.0.0.1");
    });
  }

  async runInstall(
    projectId: string,
    workspaceRoot: string,
    signal?: AbortSignal,
  ): Promise<InstallResult> {
    void projectId;
    const startedAt = Date.now();
    const approval = await runPnpm(["approve-builds", "--all"], workspaceRoot, signal);
    const install = await runPnpm(["install"], workspaceRoot, signal).catch(async (error: Error & { stdout?: string; stderr?: string }) => {
      const output = `${error.stdout ?? ""}
${error.stderr ?? ""}`;
      if (!/ERR_PNPM_IGNORED_BUILDS|Ignored build scripts/i.test(output)) throw error;
      const retryApproval = await runPnpm(["approve-builds", "--all"], workspaceRoot, signal);
      const retryInstall = await runPnpm(["install"], workspaceRoot, signal);
      return {
        stdout: `${error.stdout ?? ""}
${retryApproval.stdout}
${retryInstall.stdout}`,
        stderr: `${error.stderr ?? ""}
${retryApproval.stderr}
${retryInstall.stderr}`,
      };
    });
    return {
      exitCode: 0,
      stdout: `${approval.stdout}
${install.stdout}`,
      stderr: `${approval.stderr}
${install.stderr}`,
      durationMs: Date.now() - startedAt,
    };
  }

  async startDevServer(
    projectId: string,
    workspaceRoot: string,
    signal?: AbortSignal,
    requestedPort?: number | null,
  ): Promise<DevProcessHandle> {
    await this.stop(projectId);

    const args = requestedPort ? ["dev", "--", "--port", String(requestedPort)] : ["dev"];
    const child = spawn("pnpm", args, {
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
