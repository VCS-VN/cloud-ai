import type { CodeToolDefinition, ProjectToolResult, ProviderFunctionToolCall, ToolExecutionContext } from "../code-tools/code-agent-types";
import type { CodeToolRegistry } from "../code-tools/code-tool-registry.server";
import type { ProjectState } from "../project/project-state.schema";
import type { ThinkingResult } from "../thinking/thinking.schema";

export type PreloadedTasteSkill = {
  content: string;
  hash: string;
};

export type AgenticLoopInput = {
  projectId: string;
  userId?: string;
  messageId?: string;
  runId: string;
  userPrompt: string;
  projectState: ProjectState;
  selectedStoreSlug?: string | null;
  thinkingResult: ThinkingResult;
  context: ToolExecutionContext;
  preloadedTasteSkill?: PreloadedTasteSkill;
  /** When set, model tool list matches executeTool (required for init registry). */
  registry?: CodeToolRegistry;
  /** Block early text-only completion until storefront UI requirements are met. */
  requireStorefrontUiBeforeCompletion?: boolean;
  /** Paths already on disk at loop start (infra seed + prior writes). */
  pathsSatisfiedAtRunStart?: ReadonlySet<string>;
  /** All of these paths must be present (in start set or changedFiles) before text-only completion. */
  requiredPathsBeforeCompletion?: readonly string[];
  /** Block early text-only completion when a patch/apply request has not mutated any file. */
  requireMutationBeforeCompletion?: boolean;
  /** User-facing-internal hint for the model when mutation is still missing. */
  mutationCompletionHint?: string;
  /** Do not stream raw model text to the user (init uses skeleton + status events only). */
  suppressAssistantStreaming?: boolean;
  signal?: AbortSignal;
};

export type AgenticLoopDeps = {
  model: string;
  maxIterations: number;
  maxConsecutiveToolErrors: number;
  callModel: (input: ModelCallInput) => Promise<ModelCallResult>;
  executeTool: (toolCall: ProviderFunctionToolCall) => Promise<ProjectToolResult>;
  sendEvent: (event: unknown) => void | Promise<void>;
};

export type ModelCallInput = {
  messages: ConversationMessage[];
  tools: CodeToolDefinition[];
  onTextDelta?: (delta: string) => void | Promise<void>;
};

export type ModelCallResult = {
  toolCalls: ProviderFunctionToolCall[];
  outputText: string;
  raw: unknown;
};

export type AgenticLoopResult = {
  status: "completed" | "failed" | "max_iterations" | "aborted";
  summary: string;
  changedFiles: string[];
  iterations: number;
  totalToolCalls: number;
};

export type ConversationMessage =
  | { role: "system"; content: string }
  | { role: "developer"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string }
  | { type: "function_call"; call_id: string; name: string; arguments: string }
  | { type: "function_call_output"; call_id: string; output: string };
