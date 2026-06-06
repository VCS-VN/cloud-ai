import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type Pm2InstanceStatus = "online" | "stopped" | "errored" | "missing";

export type Pm2InstanceSummary = {
  name: string;
  status: Pm2InstanceStatus;
  pid?: number;
  port?: number;
  restarts?: number;
};

type Pm2RawProcess = {
  name?: string;
  pm_id?: number;
  pid?: number;
  pm2_env?: { status?: string; PORT?: string; restart_time?: number };
};

function parseStatus(raw: string | undefined): Pm2InstanceStatus {
  if (!raw) return "missing";
  if (raw === "online") return "online";
  if (raw === "stopped") return "stopped";
  return "errored";
}

export async function getPm2Instance(
  name: string,
): Promise<Pm2InstanceSummary> {
  try {
    const { stdout } = await execFileAsync("pm2", ["jlist"], {
      maxBuffer: 5 * 1024 * 1024,
    });
    const list = JSON.parse(stdout) as Pm2RawProcess[];
    const found = list.find((p) => p.name === name);
    if (!found) {
      return { name, status: "missing" };
    }
    return {
      name,
      status: parseStatus(found.pm2_env?.status),
      pid: found.pid,
      port: found.pm2_env?.PORT ? Number(found.pm2_env.PORT) : undefined,
      restarts: found.pm2_env?.restart_time,
    };
  } catch {
    return { name, status: "missing" };
  }
}
