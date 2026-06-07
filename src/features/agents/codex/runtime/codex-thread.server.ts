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

export class BoundedCodexThread {
  private readonly thread: Thread;
  private readonly skillToolCallbacks?: ProjectReadSkillCallbacks;

  constructor(thread: Thread, skillToolCallbacks?: ProjectReadSkillCallbacks) {
    this.thread = thread;
    this.skillToolCallbacks = skillToolCallbacks;
  }

  async runTurn(input: CodexTurnInput): Promise<CodexTurnSummary> {
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
    sandboxMode: input.sandboxMode ?? "workspace-write",
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
