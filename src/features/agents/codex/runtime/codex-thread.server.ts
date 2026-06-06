import { Codex, type Thread, type ThreadEvent, type Usage } from "@openai/codex-sdk";
import type { CodexEnvAvailable } from "@/server/env/codex";

export type CodexThreadInput = {
  env: CodexEnvAvailable;
  draftWorkspacePath: string;
};

export type CodexTurnInput = {
  prompt: string;
  signal?: AbortSignal;
};

export type CodexTurnSummary = {
  finalResponse: string;
  usage: Usage | null;
  fileChanges: string[];
};

export class BoundedCodexThread {
  private readonly thread: Thread;

  constructor(thread: Thread) {
    this.thread = thread;
  }

  async runTurn(input: CodexTurnInput): Promise<CodexTurnSummary> {
    const turn = await this.thread.run(input.prompt, { signal: input.signal });
    const fileChanges: string[] = [];
    for (const item of turn.items) {
      if (item.type === "file_change") {
        for (const change of item.changes) fileChanges.push(change.path);
      }
    }
    return {
      finalResponse: turn.finalResponse,
      usage: turn.usage,
      fileChanges,
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
    sandboxMode: "workspace-write",
    skipGitRepoCheck: true,
    networkAccessEnabled: false,
    approvalPolicy: "never",
    additionalDirectories: [],
  });
  return new BoundedCodexThread(thread);
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
