import { spawn } from "node:child_process";
import type { ValidationResult } from "../code-agent-types";
import { isValidationCommandAllowed, normalizeValidationCommand } from "./command-allowlist.server";
const DEFAULT_MAX_SUMMARY_CHARS = 2_000;
const SECRET_PATTERN = /(sk-[A-Za-z0-9_-]+|(?:token|api[_-]?key|secret)\s*=\s*[^\s]+)/gi;

export type ValidationCommandRunner = (input: {
  command: string;
  cwd: string;
  onStdout?: (line: string) => void;
  onStderr?: (line: string) => void;
}) => Promise<{
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
  onStdout?: (line: string) => void;
  onStderr?: (line: string) => void;
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
      const result = await runner({ command, cwd: input.workspaceRoot, onStdout: input.onStdout, onStderr: input.onStderr });
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

async function runCommand(input: {
  command: string;
  cwd: string;
  onStdout?: (line: string) => void;
  onStderr?: (line: string) => void;
}) {
  const startedAt = Date.now();
  const [binary, ...args] = input.command.split(" ");
  return new Promise<{ exitCode: number; stdout: string; stderr: string; durationMs: number }>((resolve) => {
    let stdout = "";
    let stderr = "";
    const child = spawn(binary, args, { cwd: input.cwd });
    const timeout = setTimeout(() => {
      stderr += "\nValidation command timed out.";
      input.onStderr?.("Validation command timed out.");
      child.kill("SIGTERM");
    }, 120_000);

    const consume = (chunk: Buffer, stream: "stdout" | "stderr") => {
      const text = chunk.toString();
      if (stream === "stdout") stdout += text;
      else stderr += text;
      for (const line of text.split(/\r?\n/).filter(Boolean)) {
        if (stream === "stdout") input.onStdout?.(sanitizeSummary(line, 1_000));
        else input.onStderr?.(sanitizeSummary(line, 1_000));
      }
    };

    child.stdout?.on("data", (chunk: Buffer) => consume(chunk, "stdout"));
    child.stderr?.on("data", (chunk: Buffer) => consume(chunk, "stderr"));
    child.on("error", (error) => {
      clearTimeout(timeout);
      resolve({ exitCode: 1, stdout, stderr: stderr || error.message, durationMs: Date.now() - startedAt });
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      resolve({ exitCode: typeof code === "number" ? code : 1, stdout, stderr, durationMs: Date.now() - startedAt });
    });
  });
}

export type DesignComplianceScope = "changed-files" | "full-storefront";

/**
 * Resolves the design compliance validation scope based on the execution context.
 * - "full-storefront": used during initialization, identity-level redesign, and explicit design sync.
 * - "changed-files": used for normal feature updates, text changes, and local component fit adjustments.
 */
export function resolveDesignComplianceScope(context: {
  isInit?: boolean;
  isRedesign?: boolean;
  isExplicitSync?: boolean;
}): DesignComplianceScope {
  if (context.isInit || context.isRedesign || context.isExplicitSync) {
    return "full-storefront";
  }
  return "changed-files";
}

export async function runProjectDesignComplianceValidation(_input: {
  workspaceRoot: string;
  filePaths?: string[];
}): Promise<ValidationResult> {
  return {
    status: "skipped",
    commands: [
      {
        command: "design-compliance",
        status: "skipped",
        stdoutSummary:
          "Design token compliance validation is disabled. DESIGN.md is a reference template for the agent; UI quality is guided by the taste skill.",
        durationMs: 0,
      },
    ],
    canRepair: false,
  };
}
