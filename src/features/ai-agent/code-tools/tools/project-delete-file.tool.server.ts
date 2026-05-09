import type { CodeToolDefinition } from "../code-agent-types";
import { toolError, toolSuccess } from "../code-tool-executor.server";
import { ProjectPatchPolicyError, ProjectPatchService } from "../services/project-patch-service.server";

export function createProjectDeleteFileTool(service = new ProjectPatchService()): CodeToolDefinition<{ path?: string; reason?: string }> {
  return {
    name: "project_delete_file",
    category: "mutate",
    description: "Delete a project file. Disabled by default; requires explicit human review when enabled.",
    strict: true,
    requiresInspection: true,
    requiresMutationLock: true,
    highRisk: true,
    parametersJsonSchema: { type: "object", properties: { path: { type: "string" }, reason: { type: "string" } }, required: ["path", "reason"], additionalProperties: false },
    handler: async ({ context, args }) => {
      const startedAt = Date.now();
      try {
        const result = await service.deleteFile({ workspaceRoot: context.workspaceRoot, relativePath: args.path ?? "" });
        Object.assign(context, { __codeToolChangedFiles: result.changedFiles });
        return toolSuccess({ context, toolName: "project_delete_file", category: "mutate", startedAt, data: result });
      } catch (error) {
        if (error instanceof ProjectPatchPolicyError) return toolError(context, "project_delete_file", "mutate", startedAt, error.code, error.message, true);
        throw error;
      }
    },
  };
}
