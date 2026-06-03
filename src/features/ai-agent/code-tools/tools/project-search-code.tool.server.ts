import type { CodeToolDefinition } from "../code-agent-types";
import { toolError, toolSuccess } from "../code-tool-executor.server";
import { searchProjectCode } from "../services/project-code-search.server";

/** @deprecated Use grepTool instead. Remove after 2026-07-01. */
export const projectSearchCodeTool: CodeToolDefinition<{ query: string; globs?: string[]; maxResults?: number }> = {
  name: "project_search_code",
  category: "inspect",
  description: "Search project source code and return redacted line snippets.",
  strict: true,
  parametersJsonSchema: {
    type: "object",
    additionalProperties: false,
    required: ["query"],
    properties: {
      query: { type: "string" },
      globs: { type: "array", items: { type: "string" } },
      maxResults: { type: "number", minimum: 1, maximum: 30 },
    },
  },
  handler: async ({ context, args }) => {
    const startedAt = Date.now();
    const result = await searchProjectCode({ workspaceRoot: context.workspaceRoot, query: args.query, globs: args.globs, maxResults: args.maxResults });
    if (!result.ok) return toolError(context, "project_search_code", "inspect", startedAt, result.error.code, result.error.message, true);
    return toolSuccess({ context, toolName: "project_search_code", category: "inspect", startedAt, data: result.data });
  },
};
