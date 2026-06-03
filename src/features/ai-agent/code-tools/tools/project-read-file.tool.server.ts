import type { CodeToolDefinition } from "../code-agent-types";
import { toolError, toolSuccess } from "../code-tool-executor.server";
import { readProjectFile } from "../services/project-file-reader.server";

/** @deprecated Use readTool instead. Remove after 2026-07-01. */
export const projectReadFileTool: CodeToolDefinition<{ path: string; maxBytes?: number }> = {
  name: "project_read_file",
  category: "inspect",
  description: "Read a safe project-relative file with checksum, line count, truncation metadata, and secret redaction.",
  strict: true,
  parametersJsonSchema: {
    type: "object",
    additionalProperties: false,
    required: ["path"],
    properties: {
      path: { type: "string" },
      maxBytes: { type: "number", minimum: 1, maximum: 120000 },
    },
  },
  handler: async ({ context, args }) => {
    const startedAt = Date.now();
    const result = await readProjectFile({ workspaceRoot: context.workspaceRoot, path: args.path, maxBytes: args.maxBytes });
    if (!result.ok) return toolError(context, "project_read_file", "inspect", startedAt, result.error.code, result.error.message, true);
    return toolSuccess({ context, toolName: "project_read_file", category: "inspect", startedAt, data: result.data });
  },
};
