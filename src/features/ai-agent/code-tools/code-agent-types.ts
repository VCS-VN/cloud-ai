import type { ProjectState } from "../project/project-state.schema";

export type CodeToolCategory = "inspect" | "mutate" | "validate" | "snapshot" | "preview";

export type ToolExecutionContext = {
  userId: string;
  orgId?: string;
  projectId: string;
  messageId: string;
  workspaceRoot: string;
  projectState: ProjectState;
  stream?: {
    send: (event: unknown) => void | Promise<void>;
  };
  flags?: {
    designRulesLoaded?: boolean;
    isUiRelatedChange?: boolean;
    tasteSkillLoaded?: boolean;
  };
  designRuleHash?: string;
  tasteSkillHash?: string;
};

export type CodeToolDefinition<TArgs = unknown, TData = unknown> = {
  name: string;
  category: CodeToolCategory;
  description: string;
  parametersJsonSchema: Record<string, unknown>;
  strict: boolean;
  requiresInspection?: boolean;
  requiresMutationLock?: boolean;
  highRisk?: boolean;
  handler: (input: { context: ToolExecutionContext; args: TArgs }) => Promise<ProjectToolResult<TData>>;
};

export type ProviderFunctionToolCall = {
  callId: string;
  name: string;
  arguments: unknown;
};

export type ProjectToolResult<TData = unknown> = {
  ok: boolean;
  data?: TData;
  error?: {
    code: string;
    message: string;
    recoverable: boolean;
  };
  warnings?: string[];
  metadata: {
    toolName: string;
    category: CodeToolCategory;
    projectId: string;
    messageId: string;
    durationMs: number;
  };
};

export type CodeToolPhase = "context_bootstrap" | "inspection" | "planning" | "mutation" | "validation" | "repair" | "finalize";

export type CodeToolLoopStatus =
  | "completed"
  | "failed"
  | "human_review_required"
  | "clarification_required";

export type CodeToolLoopResult = {
  status: CodeToolLoopStatus;
  summary: string;
  changedFiles: string[];
  validationStatus: "passed" | "failed" | "skipped";
  reason?: string;
};

export type PatchResult = {
  changedFiles: string[];
  createdFiles: string[];
  modifiedFiles: string[];
  deletedFiles: string[];
  insertions: number;
  deletions: number;
  requiresPreviewRestart: boolean;
  requiresPackageInstall: boolean;
  warnings: string[];
};

export type ValidationResult = {
  status: "passed" | "failed" | "skipped";
  commands: Array<{
    command: string;
    status: "passed" | "failed" | "skipped";
    exitCode?: number;
    stdoutSummary?: string;
    stderrSummary?: string;
    durationMs: number;
  }>;
  canRepair: boolean;
};
