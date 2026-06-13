import pm2 from "pm2";
import path from "node:path";
import { getPreviewRuntimeConfig } from "./preview-runtime-config.server";

export type PreviewPm2Status = "online" | "stopped" | "errored" | "launching" | "missing";

export type PreviewPm2Process = {
  name: string;
  status: PreviewPm2Status;
  pid: number | null;
  restartCount: number;
  uptimeMs: number | null;
  memoryBytes: number | null;
  outLogPath: string | null;
  errorLogPath: string | null;
};

export type StartPreviewProcessInput = {
  projectId: string;
  workspaceRoot: string;
  port: number;
  previewHost?: string | null;
  env?: Record<string, string | undefined>;
};

function toProcessName(projectId: string) {
  return `proj-${projectId}`;
}

function normalizeStatus(status?: string): PreviewPm2Status {
  if (status === "online") return "online";
  if (status === "stopped") return "stopped";
  if (status === "errored") return "errored";
  if (status === "launching") return "launching";
  return "missing";
}

export function buildPreviewPm2Args(port: number): string[] {
  return ["dev", "--port", String(port), "--host", "127.0.0.1"];
}

export class Pm2Driver {
  private connected = false;

  async connect() {
    if (this.connected) return;
    await new Promise<void>((resolve, reject) => {
      pm2.connect((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
    this.connected = true;
  }

  async disconnect() {
    if (!this.connected) return;
    pm2.disconnect();
    this.connected = false;
  }

  async list(): Promise<PreviewPm2Process[]> {
    await this.connect();
    const processes = await new Promise<pm2.ProcessDescription[]>((resolve, reject) => {
      pm2.list((error, list) => {
        if (error) reject(error);
        else resolve(list ?? []);
      });
    });
    return processes.filter((process) => process.name?.startsWith("proj-")).map(mapPm2Process);
  }

  async describe(projectId: string): Promise<PreviewPm2Process> {
    await this.connect();
    const name = toProcessName(projectId);
    const descriptions = await new Promise<pm2.ProcessDescription[]>((resolve, reject) => {
      pm2.describe(name, (error, processDescription) => {
        if (error) reject(error);
        else resolve(processDescription ?? []);
      });
    });
    return descriptions[0] ? mapPm2Process(descriptions[0]) : emptyProcess(name);
  }

  async start(input: StartPreviewProcessInput): Promise<PreviewPm2Process> {
    await this.connect();
    const config = getPreviewRuntimeConfig();
    const name = toProcessName(input.projectId);
    const env = {
      ...input.env,
      VITE_PROJECT_ID: input.projectId,
      VITE_PORT: String(input.port),
      ...(config.publicHost ? { VITE_PREVIEW_PUBLIC_HOST: config.publicHost } : {}),
      ...(input.previewHost ? { VITE_PREVIEW_HOST: input.previewHost } : {}),
    };
    await new Promise<void>((resolve, reject) => {
      const startOptions = {
        name,
        script: "pnpm",
        args: buildPreviewPm2Args(input.port),
        cwd: input.workspaceRoot,
        env,
        autorestart: true,
        max_memory_restart: config.processMaxMemory,
        out_file: path.join(config.pm2LogRoot, `${name}-out.log`),
        error_file: path.join(config.pm2LogRoot, `${name}-error.log`),
        merge_logs: true,
        log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      } as pm2.StartOptions & Record<string, unknown>;
      pm2.start(
        startOptions,
        (error) => {
          if (error) reject(error);
          else resolve();
        },
      );
    });
    return this.describe(input.projectId);
  }

  async stop(projectId: string) {
    await this.connect();
    await this.pm2Action("stop", toProcessName(projectId));
  }

  async restart(projectId: string) {
    await this.connect();
    await this.pm2Action("restart", toProcessName(projectId));
  }

  async delete(projectId: string) {
    await this.connect();
    await this.pm2Action("delete", toProcessName(projectId));
  }

  private async pm2Action(action: "stop" | "restart" | "delete", name: string) {
    await new Promise<void>((resolve, reject) => {
      pm2[action](name, (error) => {
        if (error && !/process or namespace not found/i.test(error.message)) reject(error);
        else resolve();
      });
    });
  }
}

function mapPm2Process(process: pm2.ProcessDescription): PreviewPm2Process {
  const monit = process.monit as { memory?: number } | undefined;
  const pm2Env = process.pm2_env as ({ status?: string; pm_uptime?: number; restart_time?: number; pm_out_log_path?: string; pm_err_log_path?: string }) | undefined;
  return {
    name: process.name ?? "unknown",
    status: normalizeStatus(pm2Env?.status),
    pid: process.pid ?? null,
    restartCount: pm2Env?.restart_time ?? 0,
    uptimeMs: pm2Env?.pm_uptime ? Date.now() - pm2Env.pm_uptime : null,
    memoryBytes: monit?.memory ?? null,
    outLogPath: pm2Env?.pm_out_log_path ?? null,
    errorLogPath: pm2Env?.pm_err_log_path ?? null,
  };
}

function emptyProcess(name: string): PreviewPm2Process {
  return { name, status: "missing", pid: null, restartCount: 0, uptimeMs: null, memoryBytes: null, outLogPath: null, errorLogPath: null };
}
