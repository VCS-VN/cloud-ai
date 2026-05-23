import type {
  CodeToolDefinition,
  ProjectToolResult,
  ProviderFunctionToolCall,
  ToolExecutionContext,
} from "./code-agent-types";
import type { CodeToolRegistry } from "./code-tool-registry.server";
import { evaluateProjectRiskPolicy } from "./services/project-risk-policy.server";
import {
  scanPatchContent,
  formatViolations,
} from "./services/design-patch-content-validator.server";
import { buildProjectTokenIndex } from "./services/design-token-extractor.server";
import { loadProjectDesignRules } from "./services/design-file-service.server";
import { scanGeneratedApiClientPolicy, formatGeneratedApiClientPolicyViolations } from "./services/generated-api-client-policy.server";
import { GENERATED_PROJECT_ENV_POLICY_MESSAGE, isProtectedGeneratedEnvPath } from "./services/project-patch-service.server";
import { isStorefrontUiPath } from "./services/project-path-guard.server";

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
    const available = input.registry.list().map((t) => t.name).slice(0, 20).join(", ");
    return toolError(
      input.context,
      input.toolCall.name,
      "inspect",
      startedAt,
      "TOOL_NOT_FOUND",
      `Unsupported tool call: "${input.toolCall.name}". Available tools include: ${available}. Re-emit the call using one of these tool names.`,
      true,
    );
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

  const argParseResult = parseToolArgs(input.toolCall.arguments);
  if (!argParseResult.ok) {
    return toolError(
      input.context,
      tool.name,
      tool.category,
      startedAt,
      "TOOL_ARGS_PARSE_FAILED",
      `Tool arguments are not valid JSON: ${argParseResult.error}. Re-emit the call with a valid JSON object.`,
      true,
    );
  }
  const args = softNormalizeToolArgs(tool, argParseResult.value);

  if (tool.category === "mutate") {
    const changedFiles = extractPotentialChangedFiles(args);
    if (changedFiles.some(isProtectedGeneratedEnvPathSafe)) {
      console.warn(JSON.stringify({
        event: "generated_project_env_edit_blocked",
        tool: tool.name,
      }));
      return toolError(
        input.context,
        tool.name,
        tool.category,
        startedAt,
        "PROTECTED_ENV_FILE",
        GENERATED_PROJECT_ENV_POLICY_MESSAGE,
        true,
      );
    }
  }

  if (tool.category === "mutate") {
    const changedFilesWithContent = extractChangedFilesWithContent(tool.name, args);
    if (changedFilesWithContent.length > 0) {
      const apiClientPolicy = scanGeneratedApiClientPolicy(changedFilesWithContent);
      if (!apiClientPolicy.ok) {
        console.warn(JSON.stringify({
          event: "generated_api_client_policy_violation",
          tool: tool.name,
          violationCount: apiClientPolicy.violations.length,
        }));
        return toolError(
          input.context,
          tool.name,
          tool.category,
          startedAt,
          "GENERATED_API_CLIENT_POLICY_VIOLATION",
          formatGeneratedApiClientPolicyViolations(apiClientPolicy.violations),
          true,
        );
      }
    }
  }

  // Storefront UI mutation gate: block UI changes without loaded design rules.
  if (tool.category === "mutate") {
    const flags = (input.context as any).flags;
    const designRulesLoaded = flags?.designRulesLoaded === true;
    const changedFiles = extractPotentialChangedFiles(args);
    const storefrontPaths = changedFiles.filter((file) => isUiRelatedFilePath(file));

    if (!designRulesLoaded && storefrontPaths.length > 0) {
      return toolError(
        input.context,
        tool.name,
        tool.category,
        startedAt,
        "DESIGN_RULES_REQUIRED",
        `Customer-facing storefront UI cannot be modified without loaded design rules. ` +
        `Affected paths: ${storefrontPaths.join(", ")}. ` +
        `Call project_read_design_rules first to load DESIGN.md.`,
        true,
      );
    }
  }

  if (tool.category === "mutate") {
    const changedPaths = extractPotentialChangedFiles(args);
    const hasUiPath = changedPaths.some((file) => isUiRelatedFilePath(file));
    if (hasUiPath) {
      const changedFilesWithContent = extractChangedFilesWithContent(tool.name, args);
      if (changedFilesWithContent.length > 0) {
        try {
          const designRules = await loadProjectDesignRules({
            projectId: input.context.projectId,
            workspaceRoot: input.context.workspaceRoot,
          });
          (input.context as any).designRuleHash = designRules.hash;
          const tokens = buildProjectTokenIndex(designRules.markdown);
          const verdict = scanPatchContent({
            changedFiles: changedFilesWithContent,
            tokens,
          });
          if (!verdict.ok) {
            console.warn(
              JSON.stringify({
                event: "design_token_literal_off_rule",
                tool: tool.name,
                violationCount: verdict.violations.length,
              }),
            );
            return toolError(
              input.context,
              tool.name,
              tool.category,
              startedAt,
              "DESIGN_TOKEN_LITERAL_OFF_RULE",
              formatViolations(verdict.violations),
              true,
            );
          }
        } catch (error: any) {
          if (error?.code !== "DESIGN_FILE_MISSING") {
            console.warn(
              JSON.stringify({
                event: "design_patch_validator_load_failed",
                error:
                  error instanceof Error
                    ? error.message.slice(0, 200)
                    : String(error).slice(0, 200),
              }),
            );
          }
        }
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
  } catch (error) {
    console.warn(JSON.stringify({
      event: "tool_args_json_parse_failed",
      error: error instanceof Error ? error.message : String(error),
      preview: raw.slice(0, 200),
    }));
    return {};
  }
}

export function parseToolArgs(rawArgs: unknown): { ok: true; value: unknown } | { ok: false; error: string } {
  if (rawArgs === undefined || rawArgs === null) {
    return { ok: true, value: {} };
  }
  if (typeof rawArgs !== "string") {
    return { ok: true, value: rawArgs };
  }
  const trimmed = rawArgs.trim();
  if (trimmed === "") {
    return { ok: true, value: {} };
  }
  try {
    return { ok: true, value: JSON.parse(trimmed) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "invalid JSON" };
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


function extractChangedFilesWithContent(
  toolName: string,
  args: unknown,
): Array<{ path: string; content: string }> {
  if (!isRecord(args)) return [];
  if (toolName === "project_create_file") {
    const path = typeof args.path === "string" ? args.path : "";
    const content = typeof args.content === "string" ? args.content : "";
    if (!path) return [];
    return [{ path, content }];
  }
  if (toolName === "project_apply_patch") {
    const patch = typeof args.patch === "string" ? args.patch : "";
    const expected = Array.isArray(args.expectedChangedFiles)
      ? args.expectedChangedFiles.filter(
          (file): file is string => typeof file === "string",
        )
      : [];
    if (!patch || expected.length === 0) return [];
    const synthesized = synthesizePatchContents(patch, expected);
    return synthesized;
  }
  return [];
}

function synthesizePatchContents(
  patch: string,
  expectedChangedFiles: ReadonlyArray<string>,
): Array<{ path: string; content: string }> {
  const fileBlocks = parseUnifiedDiff(patch);
  const out: Array<{ path: string; content: string }> = [];
  for (const path of expectedChangedFiles) {
    const block = fileBlocks.get(path);
    if (block) {
      out.push({ path, content: block });
    } else {
      out.push({ path, content: "" });
    }
  }
  return out;
}

function parseUnifiedDiff(patch: string): Map<string, string> {
  const blocks = new Map<string, string>();
  const lines = patch.split("\n");
  let currentPath: string | null = null;
  let buffer: string[] = [];
  const flush = () => {
    if (currentPath) {
      const existing = blocks.get(currentPath) ?? "";
      blocks.set(currentPath, existing + buffer.join("\n"));
    }
    buffer = [];
  };
  for (const line of lines) {
    const fileMatch = line.match(/^\+\+\+\s+(?:b\/)?(.+)$/);
    if (fileMatch) {
      flush();
      currentPath = fileMatch[1].trim();
      continue;
    }
    if (line.startsWith("+") && !line.startsWith("+++")) {
      buffer.push(line.slice(1));
    }
  }
  flush();
  return blocks;
}

function isUiRelatedFilePath(filePath: string): boolean {
  return isStorefrontUiPath(filePath) || filePath.startsWith("public/");
}

function isProtectedGeneratedEnvPathSafe(filePath: string) {
  try {
    return isProtectedGeneratedEnvPath(filePath);
  } catch {
    return false;
  }
}
