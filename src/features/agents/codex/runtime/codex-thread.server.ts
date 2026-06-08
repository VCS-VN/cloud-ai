import { Codex, type Thread, type ThreadEvent, type Usage } from "@openai/codex-sdk";
import type { CodexEnvAvailable } from "@/server/env/codex";
import {
  PROJECT_READ_SKILL_TOOL_NAME,
  projectReadSkill,
  type ProjectReadSkillCallbacks,
  type ProjectReadSkillResult,
} from "@/features/agents/codex/skills/project-read-skill.tool.server";

export type CodexSandboxMode = "read-only" | "workspace-write" | "danger-full-access";
export type CodexReasoningEffort = "minimal" | "low" | "medium" | "high" | "xhigh";

export type CodexThreadInput = {
  env: CodexEnvAvailable;
  draftWorkspacePath: string;
  skillToolCallbacks?: ProjectReadSkillCallbacks;
  sandboxMode?: CodexSandboxMode;
  modelReasoningEffort?: CodexReasoningEffort;
};

export type CodexTurnInput = {
  prompt: string;
  signal?: AbortSignal;
};

export type CodexTurnSummary = {
  finalResponse: string;
  usage: Usage | null;
  fileChanges: string[];
  skillToolCalls: { name: string; result: ProjectReadSkillResult }[];
};

const MAX_RETRY_ATTEMPTS = 10;
const BASE_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 60_000;

function computeBackoffDelay(attempt: number): number {
  // Exponential backoff with full jitter: delay = min(base * 2^attempt, cap) * random(0..1)
  // Bounded by MAX_RETRY_DELAY_MS so we never wait longer than 60s between attempts.
  const exp = Math.min(BASE_RETRY_DELAY_MS * Math.pow(2, attempt), MAX_RETRY_DELAY_MS);
  return Math.floor(Math.random() * exp);
}

function isAbortError(error: unknown): boolean {
  if (!error) return false;
  if (error instanceof DOMException && error.name === "AbortError") return true;
  if (error instanceof Error && (error.name === "AbortError" || /aborted/i.test(error.message))) {
    return true;
  }
  return false;
}

async function delay(ms: number, signal?: AbortSignal): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export class BoundedCodexThread {
  private readonly thread: Thread;
  private readonly skillToolCallbacks?: ProjectReadSkillCallbacks;

  constructor(thread: Thread, skillToolCallbacks?: ProjectReadSkillCallbacks) {
    this.thread = thread;
    this.skillToolCallbacks = skillToolCallbacks;
  }

  async runTurn(input: CodexTurnInput): Promise<CodexTurnSummary> {
    let lastError: unknown = null;
    for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
      if (input.signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      try {
        const summary = await this.runTurnOnce(input);
        if (attempt > 0) {
          console.log(
            JSON.stringify({
              event: "codex_turn_retry_succeeded",
              attempt,
              previousFailures: attempt,
            }),
          );
        }
        return summary;
      } catch (error) {
        lastError = error;
        if (isAbortError(error)) throw error;
        const isLastAttempt = attempt === MAX_RETRY_ATTEMPTS - 1;
        const waitMs = isLastAttempt ? 0 : computeBackoffDelay(attempt);
        console.warn(
          JSON.stringify({
            event: "codex_turn_failed",
            attempt: attempt + 1,
            maxAttempts: MAX_RETRY_ATTEMPTS,
            isLastAttempt,
            waitMs,
            rawMessage: error instanceof Error ? error.message : String(error),
            rawName: error instanceof Error ? error.name : undefined,
          }),
        );
        if (isLastAttempt) break;
        await delay(waitMs, input.signal);
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error(typeof lastError === "string" ? lastError : "codex turn ended unexpectedly");
  }

  private async runTurnOnce(input: CodexTurnInput): Promise<CodexTurnSummary> {
    const turn = await this.thread.run(input.prompt, { signal: input.signal });
    const fileChanges: string[] = [];
    const skillToolCalls: { name: string; result: ProjectReadSkillResult }[] = [];
    const itemTypeCounts: Record<string, number> = {};
    for (const item of turn.items) {
      itemTypeCounts[item.type] = (itemTypeCounts[item.type] ?? 0) + 1;
      if (item.type === "file_change") {
        for (const change of item.changes) fileChanges.push(change.path);
      }
      if (item.type === "mcp_tool_call" && item.tool === PROJECT_READ_SKILL_TOOL_NAME) {
        const args = (item.arguments ?? {}) as { name?: unknown };
        const result = projectReadSkill({ name: args.name }, this.skillToolCallbacks);
        skillToolCalls.push({
          name: typeof args.name === "string" ? args.name : "<invalid>",
          result,
        });
      }
    }
    console.log(
      JSON.stringify({
        event: "codex_turn_completed",
        promptLength: input.prompt.length,
        finalResponseLength: turn.finalResponse?.length ?? 0,
        finalResponsePreview: (turn.finalResponse ?? "").slice(0, 240),
        itemCount: turn.items.length,
        itemTypeCounts,
        fileChangesCount: fileChanges.length,
        fileChangesPreview: fileChanges.slice(0, 5),
        skillToolCallsCount: skillToolCalls.length,
      }),
    );
    return {
      finalResponse: turn.finalResponse,
      usage: turn.usage,
      fileChanges,
      skillToolCalls,
    };
  }

  async *runStreamed(
    input: CodexTurnInput,
  ): AsyncGenerator<ThreadEvent> {
    const stream = await this.thread.runStreamed(input.prompt, {
      signal: input.signal,
    });
    for await (const event of stream.events) {
      yield event;
    }
  }

  get threadId(): string | null {
    return this.thread.id;
  }
}

export function createBoundedCodexThread(
  input: CodexThreadInput,
): BoundedCodexThread {
  // CODEX_DISABLE_SANDBOX=true bypasses the codex CLI's bwrap sandbox by passing
  // sandbox_mode=danger-full-access. Use this on hosts where unprivileged user
  // namespaces / network namespace creation is blocked (Ubuntu 24+ default,
  // Docker default seccomp, locked-down VPS), where bwrap fails with
  // "loopback: Failed RTM_NEWADDR: Operation not permitted" and apply_patch
  // becomes a no-op. The diff gate still enforces draft-workspace boundary.
  const sandboxDisabled = process.env.CODEX_DISABLE_SANDBOX === "true";
  const sandboxMode: CodexSandboxMode = sandboxDisabled
    ? "danger-full-access"
    : input.sandboxMode ?? "workspace-write";
  const codex = new Codex({
    apiKey: input.env.apiKey,
    baseUrl: input.env.baseUrl,
    env: {
      ...process.env,
      CODEX_HOME: input.env.codexHome,
    } as Record<string, string>,
  });
  const thread = codex.startThread({
    model: input.env.model,
    workingDirectory: input.draftWorkspacePath,
    sandboxMode,
    modelReasoningEffort: input.modelReasoningEffort,
    skipGitRepoCheck: true,
    networkAccessEnabled: false,
    approvalPolicy: "never",
    additionalDirectories: [],
  });
  return new BoundedCodexThread(thread, input.skillToolCallbacks);
}

export function summarizeUsage(usage: Usage | null): {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
} | null {
  if (!usage) return null;
  return {
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    cachedInputTokens: usage.cached_input_tokens,
  };
}
