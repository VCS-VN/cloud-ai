import type {
  CodeToolDefinition,
  ProjectToolResult,
  ProviderFunctionToolCall,
  ToolExecutionContext,
} from "./code-agent-types";
import type { CodeToolRegistry } from "./code-tool-registry.server";
import { evaluateProjectRiskPolicy } from "./services/project-risk-policy.server";

export async function executeProjectTool(input: {
  registry: CodeToolRegistry;
  context: ToolExecutionContext;
  toolCall: ProviderFunctionToolCall;
  inspectionCompleted: boolean;
  mutationCompleted: boolean;
  phase?: import("./code-agent-types").CodeToolPhase;
  sandboxMode?: "read-only" | "workspace-write";
}): Promise<ProjectToolResult> {
  const startedAt = Date.now();
  if (!(input.context as any).flags) {
    (input.context as any).flags = { designRulesLoaded: false };
  }
  const tool = input.registry.get(input.toolCall.name);

  if (!tool) {
    return toolError(input.context, input.toolCall.name, "inspect", startedAt, "TOOL_NOT_FOUND", "Unknown tool requested by provider.", true);
  }

  if (input.sandboxMode === "read-only" && tool.category === "mutate") {
    return toolError(
      input.context,
      tool.name,
      tool.category,
      startedAt,
      "POLICY_FORBIDDEN",
      "Mutation tools are not allowed in read-only mode.",
      true,
    );
  }

  if (input.phase) {
    const allowedForPhase = input.registry.listForPhase(input.phase).some((t) => t.name === tool.name);
    if (!allowedForPhase) {
      return toolError(
        input.context,
        tool.name,
        tool.category,
        startedAt,
        "PHASE_FORBIDDEN",
        `Tool "${tool.name}" is not allowed in phase "${input.phase}".`,
        true,
      );
    }
  }

  if (tool.requiresInspection && !input.inspectionCompleted) {
    return toolError(
      input.context,
      tool.name,
      tool.category,
      startedAt,
      "INSPECTION_REQUIRED",
      "The agent must inspect project code before using mutation tools.",
      true,
    );
  }

  if (tool.category === "mutate" && !(input.context as unknown as { __codeToolSnapshotId?: string }).__codeToolSnapshotId) {
    return toolError(
      input.context,
      tool.name,
      tool.category,
      startedAt,
      "SNAPSHOT_REQUIRED",
      "Create a project snapshot before the first mutation tool call.",
      true,
    );
  }

  const args = softNormalizeToolArgs(tool, input.toolCall.arguments);

  if (tool.category === "mutate") {
    const flags = (input.context as any).flags;
    const designRulesLoaded = flags?.designRulesLoaded === true;
    if (!designRulesLoaded) {
      const changedFiles = extractPotentialChangedFiles(args);
      const hasUiFile = changedFiles.some((file) => isUiRelatedFilePath(file));
      if (hasUiFile) {
        return toolError(
          input.context,
          tool.name,
          tool.category,
          startedAt,
          "DESIGN_RULES_REQUIRED",
          "DESIGN.md must be read before modifying UI code. Call project_read_design_rules first.",
          true,
        );
      }
    }
  }

  if (tool.category === "mutate") {
    const changedFiles = extractPotentialChangedFiles(args);
    const risk = evaluateProjectRiskPolicy({ changedFiles, highRisk: tool.highRisk });
    if (risk.requiresHumanReview) {
      return toolError(
        input.context,
        tool.name,
        tool.category,
        startedAt,
        "HUMAN_REVIEW_REQUIRED",
        risk.reasons.join(" "),
        false,
      );
    }
  }

  try {
    return await tool.handler({ context: input.context, args });
  } catch (error) {
    return toolError(
      input.context,
      tool.name,
      tool.category,
      startedAt,
      "TOOL_EXECUTION_FAILED",
      error instanceof Error ? error.message : "Tool execution failed.",
      true,
    );
  }
}

export function softNormalizeToolArgs(tool: Pick<CodeToolDefinition, "name">, rawArgs: unknown) {
  const args = typeof rawArgs === "string" ? safeJsonParse(rawArgs) : rawArgs;
  const record = isRecord(args) ? args : {};

  if (tool.name === "project_get_file_tree") {
    return {
      root: typeof record.root === "string" ? record.root : "",
      maxDepth: clampNumber(record.maxDepth, 1, 8, 4),
    };
  }

  if (tool.name === "project_search_code") {
    return {
      query: String(record.query ?? ""),
      globs: Array.isArray(record.globs) ? record.globs.filter((glob): glob is string => typeof glob === "string") : ["src/**/*.{ts,tsx}"],
      maxResults: clampNumber(record.maxResults, 1, 30, 12),
    };
  }

  return record;
}

export function toolSuccess<TData>(input: {
  context: ToolExecutionContext;
  toolName: string;
  category: ProjectToolResult["metadata"]["category"];
  startedAt: number;
  data: TData;
  warnings?: string[];
}): ProjectToolResult<TData> {
  return {
    ok: true,
    data: input.data,
    warnings: input.warnings ?? [],
    metadata: {
      toolName: input.toolName,
      category: input.category,
      projectId: input.context.projectId,
      messageId: input.context.messageId,
      durationMs: Date.now() - input.startedAt,
    },
  };
}

export function toolError(
  context: ToolExecutionContext,
  toolName: string,
  category: ProjectToolResult["metadata"]["category"],
  startedAt: number,
  code: string,
  message: string,
  recoverable: boolean,
): ProjectToolResult {
  return {
    ok: false,
    error: { code, message, recoverable },
    metadata: {
      toolName,
      category,
      projectId: context.projectId,
      messageId: context.messageId,
      durationMs: Date.now() - startedAt,
    },
  };
}

function safeJsonParse(raw: string) {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const numberValue = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, numberValue));
}

function extractPotentialChangedFiles(args: unknown) {
  if (!isRecord(args)) return [];
  if (Array.isArray(args.expectedChangedFiles)) {
    return args.expectedChangedFiles.filter((file): file is string => typeof file === "string");
  }
  if (typeof args.path === "string") return [args.path];
  return [];
}

const UI_RELATED_GLOBS = [
  "src/routes/",
  "src/components/",
  "src/features/",
  "src/styles/",
  "tailwind.config",
  "postcss.config",
];

function isUiRelatedFilePath(filePath: string): boolean {
  return UI_RELATED_GLOBS.some((glob) => filePath.startsWith(glob) || filePath.includes(`/${glob}`));
}
