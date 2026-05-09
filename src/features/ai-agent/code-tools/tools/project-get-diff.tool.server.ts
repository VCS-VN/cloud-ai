import type { CodeToolDefinition } from "../code-agent-types";
import { toolSuccess } from "../code-tool-executor.server";
import { ProjectPatchService } from "../services/project-patch-service.server";

export function createProjectGetDiffTool(service = new ProjectPatchService()): CodeToolDefinition<{ includePatch?: boolean; maxBytes?: number }> {
  return {
    name: "project_get_diff",
    category: "inspect",
    description: "Return a bounded summary of files changed during the current run.",
    strict: true,
    parametersJsonSchema: { type: "object", properties: { includePatch: { type: "boolean" }, maxBytes: { type: "number" } }, required: ["includePatch", "maxBytes"], additionalProperties: false },
    handler: async ({ context, args }) => {
      const startedAt = Date.now();
      const changedFiles = (context as unknown as { __codeToolChangedFiles?: string[] }).__codeToolChangedFiles;
      const data = changedFiles ? { changedFiles, patch: args.includePatch ? "" : undefined, truncated: false } : await service.getDiff({ workspaceRoot: context.workspaceRoot, includePatch: args.includePatch, maxBytes: args.maxBytes });
      return toolSuccess({ context, toolName: "project_get_diff", category: "inspect", startedAt, data });
    },
  };
}
