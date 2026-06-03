import type { CodeToolDefinition, ProjectToolResult, ToolExecutionContext } from "../code-agent-types";

export type ToolHookType = "pre_write" | "post_write";

export type ToolHookResult =
  | { ok: true; warnings?: string[] }
  | { ok: false; error: NonNullable<ProjectToolResult["error"]>; warnings?: string[] };

export type ToolHook = {
  type: ToolHookType;
  applicable: (tool: CodeToolDefinition, args: unknown) => boolean;
  handler: (input: {
    tool: CodeToolDefinition;
    context: ToolExecutionContext;
    args: unknown;
  }) => Promise<ToolHookResult>;
};
