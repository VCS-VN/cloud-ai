import type {
  CodeToolDefinition,
  ProjectToolResult,
  ProviderFunctionToolCall,
  ToolExecutionContext,
} from "./code-agent-types";
import type { CodeToolRegistry } from "./code-tool-registry.server";
import { createPreWriteHooks } from "./hooks/pre-write-hooks.server";
import { createPostWriteHooks } from "./hooks/post-write-hooks.server";
import { isStorefrontUiPath } from "./services/project-path-guard.server";
import { isProtectedGeneratedEnvPath } from "./services/project-patch-service.server";

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
    return toolError(input.context, input.toolCall.name, "inspect", startedAt, "TOOL_NOT_FOUND", `Unsupported tool call: "${input.toolCall.name}". Available tools include: ${available}. Re-emit the call using one of these tool names.`, true);
  }

  const argParseResult = parseToolArgs(input.toolCall.arguments);
  if (!argParseResult.ok) {
    return toolError(input.context, tool.name, tool.category, startedAt, "TOOL_ARGS_PARSE_FAILED", `Tool arguments are not valid JSON: ${argParseResult.error}. Re-emit the call with a valid JSON object.`, true);
  }
  const args = softNormalizeToolArgs(tool, argParseResult.value);

  const toolContext = {
    ...input.context,
    sandboxMode: input.sandboxMode,
    phase: input.phase,
    inspectionCompleted: input.inspectionCompleted,
    mutationCompleted: input.mutationCompleted,
    registry: input.registry,
    tool,
  } as ToolExecutionContext & {
    sandboxMode?: string;
    phase?: string;
    inspectionCompleted?: boolean;
    mutationCompleted?: boolean;
    registry?: CodeToolRegistry;
    tool?: CodeToolDefinition;
  };

  const preWriteHooks = createPreWriteHooks();
  for (const hook of preWriteHooks) {
    if (!hook.applicable(tool, args)) continue;
    const result = await hook.handler({ tool, context: toolContext, args });
    if (!result.ok) {
      return toolError(input.context, tool.name, tool.category, startedAt, result.error.code, result.error.message, result.error.recoverable);
    }
  }

  try {
    const result = await tool.handler({ context: input.context, args });
    const postWriteHooks = createPostWriteHooks();
    const warnings: string[] = [...(result.warnings ?? [])];
    for (const hook of postWriteHooks) {
      if (!hook.applicable(tool, args)) continue;
      const hookResult = await hook.handler({ tool, context: input.context, args });
      if (!hookResult.ok) {
        return toolError(input.context, tool.name, tool.category, startedAt, hookResult.error.code, hookResult.error.message, hookResult.error.recoverable);
      }
      if (hookResult.warnings?.length) warnings.push(...hookResult.warnings);
    }
    return warnings.length ? { ...result, warnings } : result;
  } catch (error) {
    return toolError(input.context, tool.name, tool.category, startedAt, "TOOL_EXECUTION_FAILED", error instanceof Error ? error.message : "Tool execution failed.", true);
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
