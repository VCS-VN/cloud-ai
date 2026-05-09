import type { CodeToolDefinition } from "../code-agent-types";
import { toolError, toolSuccess } from "../code-tool-executor.server";
import { readProjectFileRange } from "../services/project-file-reader.server";

export const projectReadFileRangeTool: CodeToolDefinition<{ path: string; startLine: number; endLine: number; maxBytes?: number }> = {
  name: "project_read_file_range",
  category: "inspect",
  description: "Read an inclusive line range from a safe project-relative file with secret redaction.",
  strict: true,
  parametersJsonSchema: {
    type: "object",
    additionalProperties: false,
    required: ["path", "startLine", "endLine"],
    properties: {
      path: { type: "string" },
      startLine: { type: "number", minimum: 1 },
      endLine: { type: "number", minimum: 1 },
      maxBytes: { type: "number", minimum: 1, maximum: 120000 },
    },
  },
  handler: async ({ context, args }) => {
    const startedAt = Date.now();
    const result = await readProjectFileRange({ workspaceRoot: context.workspaceRoot, path: args.path, startLine: args.startLine, endLine: args.endLine, maxBytes: args.maxBytes });
    if (!result.ok) return toolError(context, "project_read_file_range", "inspect", startedAt, result.error.code, result.error.message, true);
    return toolSuccess({ context, toolName: "project_read_file_range", category: "inspect", startedAt, data: result.data });
  },
};
