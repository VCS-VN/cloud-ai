import type { CodeToolDefinition } from "../code-agent-types";
import { toolError, toolSuccess } from "../code-tool-executor.server";
import { ProjectPatchPolicyError, ProjectPatchService } from "../services/project-patch-service.server";

export function createProjectApplyPatchTool(service = new ProjectPatchService()): CodeToolDefinition<{ patch?: string; reason?: string; expectedChangedFiles?: string[] }> {
  return {
    name: "project_apply_patch",
    category: "mutate",
    description: "Apply a bounded unified diff patch to project files.",
    strict: true,
    requiresInspection: true,
    requiresMutationLock: true,
    parametersJsonSchema: { type: "object", properties: { patch: { type: "string" }, reason: { type: "string" }, expectedChangedFiles: { type: "array", items: { type: "string" } } }, required: ["patch", "reason", "expectedChangedFiles"], additionalProperties: false },
    handler: async ({ context, args }) => {
      const startedAt = Date.now();
      try {
        const result = await service.applyPatch({ workspaceRoot: context.workspaceRoot, patch: args.patch ?? "", expectedChangedFiles: args.expectedChangedFiles });
        Object.assign(context, { __codeToolChangedFiles: result.changedFiles });
        return toolSuccess({ context, toolName: "project_apply_patch", category: "mutate", startedAt, data: result });
      } catch (error) {
        if (error instanceof ProjectPatchPolicyError) return toolError(context, "project_apply_patch", "mutate", startedAt, error.code, error.message, true);
        throw error;
      }
    },
  };
}
