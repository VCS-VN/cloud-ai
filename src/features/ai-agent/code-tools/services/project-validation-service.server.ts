import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ValidationResult } from "../code-agent-types";
import { isValidationCommandAllowed, normalizeValidationCommand } from "./command-allowlist.server";

const execFileAsync = promisify(execFile);
const DEFAULT_MAX_SUMMARY_CHARS = 2_000;
const SECRET_PATTERN = /(sk-[A-Za-z0-9_-]+|(?:token|api[_-]?key|secret)\s*=\s*[^\s]+)/gi;

export type ValidationCommandRunner = (input: { command: string; cwd: string }) => Promise<{
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}>;

export async function runProjectValidation(input: {
  workspaceRoot: string;
  commands: string[];
  runner?: ValidationCommandRunner;
  maxSummaryChars?: number;
}): Promise<ValidationResult> {
  const maxSummaryChars = input.maxSummaryChars ?? DEFAULT_MAX_SUMMARY_CHARS;
  const runner = input.runner ?? runCommand;
  const commands: ValidationResult["commands"] = [];

  for (const rawCommand of input.commands) {
    const command = normalizeValidationCommand(rawCommand);
    if (!isValidationCommandAllowed(command)) {
      commands.push({ command, status: "skipped", stdoutSummary: "Command is not allowlisted.", durationMs: 0 });
      continue;
    }

    try {
      const result = await runner({ command, cwd: input.workspaceRoot });
      commands.push({
        command,
        status: result.exitCode === 0 ? "passed" : "failed",
        exitCode: result.exitCode,
        stdoutSummary: sanitizeSummary(result.stdout, maxSummaryChars),
        stderrSummary: sanitizeSummary(result.stderr, maxSummaryChars),
        durationMs: result.durationMs,
      });
    } catch (error) {
      commands.push({
        command,
        status: "failed",
        exitCode: 1,
        stderrSummary: sanitizeSummary(error instanceof Error ? error.message : "Validation command failed.", maxSummaryChars),
        durationMs: 0,
      });
    }
  }

  if (commands.length === 0 || commands.every((command) => command.status === "skipped")) {
    return { status: "skipped", commands, canRepair: false };
  }

  const failed = commands.some((command) => command.status === "failed");
  return { status: failed ? "failed" : "passed", commands, canRepair: failed };
}

export function sanitizeSummary(value: string, maxChars = DEFAULT_MAX_SUMMARY_CHARS) {
  const redacted = value.replace(SECRET_PATTERN, "[REDACTED]").replace(/\s+/g, " ").trim();
  return redacted.length > maxChars ? `${redacted.slice(0, Math.max(0, maxChars - 1))}…` : redacted;
}

async function runCommand(input: { command: string; cwd: string }) {
  const startedAt = Date.now();
  const [binary, ...args] = input.command.split(" ");
  try {
    const { stdout, stderr } = await execFileAsync(binary, args, { cwd: input.cwd, timeout: 120_000, maxBuffer: 1_000_000 });
    return { exitCode: 0, stdout: String(stdout), stderr: String(stderr), durationMs: Date.now() - startedAt };
  } catch (error) {
    const processError = error as { stdout?: unknown; stderr?: unknown; code?: unknown; message?: string };
    return {
      exitCode: typeof processError.code === "number" ? processError.code : 1,
      stdout: String(processError.stdout ?? ""),
      stderr: String(processError.stderr ?? processError.message ?? ""),
      durationMs: Date.now() - startedAt,
    };
  }
}
