import { promises as fs } from "node:fs";
import path from "node:path";
import { getPreviewRuntimeConfig } from "./preview-runtime-config.server";

export type RuntimeLogSource = "pm2" | "install";

export async function tailPm2PreviewLog(projectId: string, tail: number, source: RuntimeLogSource = "pm2"): Promise<{ lines: string[]; truncated: boolean; source: RuntimeLogSource }> {
  const cap = Math.min(Math.max(tail, 1), 1000);
  const config = getPreviewRuntimeConfig();
  if (source === "install") {
    return { lines: [], truncated: false, source };
  }
  const baseName = `proj-${projectId}`;
  const candidatePaths = [
    path.join(config.pm2LogRoot, `${baseName}-error.log`),
    path.join(config.pm2LogRoot, `${baseName}-out.log`),
  ];
  const collected: string[] = [];
  for (const candidate of candidatePaths) {
    try {
      const text = await fs.readFile(candidate, "utf8");
      const allLines = text.split(/\r?\n/);
      collected.push(...allLines.slice(-cap));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  const lines = collected.slice(-cap);
  return { lines, truncated: collected.length > lines.length, source };
}
