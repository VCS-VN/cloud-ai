import { spawn } from "node:child_process";

export type ValidationOutcome =
  | { ok: true; durationMs: number }
  | { ok: false; durationMs: number; summary: string; errorCount: number };

export type RunCommandOptions = {
  cwd: string;
  timeoutMs?: number;
  signal?: AbortSignal;
};

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

function summarizeOutput(stdout: string, stderr: string, max = 4000): string {
  const merged = [stdout, stderr].filter(Boolean).join("\n");
  const lines = merged.split(/\r?\n/).filter((line) => /error|fail|✖|✘/i.test(line));
  const trimmed = lines.length > 0 ? lines.slice(-50).join("\n") : merged.split(/\r?\n/).slice(-30).join("\n");
  return trimmed.length > max ? trimmed.slice(-max) : trimmed;
}

export function countErrors(text: string): number {
  const matches = text.match(/error/gi);
  return matches ? matches.length : 0;
}

export async function runProcess(
  command: string,
  args: string[],
  opts: RunCommandOptions,
): Promise<ValidationOutcome> {
  const startedAt = Date.now();
  return await new Promise<ValidationOutcome>((resolve) => {
    const child = spawn(command, args, {
      cwd: opts.cwd,
      env: { ...process.env, CI: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    if (opts.signal) {
      const onAbort = () => child.kill("SIGTERM");
      opts.signal.addEventListener("abort", onAbort, { once: true });
      child.once("close", () => opts.signal?.removeEventListener("abort", onAbort));
    }
    child.on("close", (code) => {
      clearTimeout(timer);
      const durationMs = Date.now() - startedAt;
      if (code === 0) {
        resolve({ ok: true, durationMs });
        return;
      }
      const summary = timedOut
        ? `process_timed_out_after_${opts.timeoutMs ?? DEFAULT_TIMEOUT_MS}ms`
        : summarizeOutput(stdout, stderr);
      resolve({
        ok: false,
        durationMs,
        summary,
        errorCount: countErrors(summary) || 1,
      });
    });
    child.on("error", () => {
      clearTimeout(timer);
      resolve({
        ok: false,
        durationMs: Date.now() - startedAt,
        summary: "process_spawn_failed",
        errorCount: 1,
      });
    });
  });
}

export async function runTypecheck(
  draftWorkspacePath: string,
  opts: { signal?: AbortSignal } = {},
): Promise<ValidationOutcome> {
  return runProcess("pnpm", ["run", "typecheck"], {
    cwd: draftWorkspacePath,
    signal: opts.signal,
  });
}
