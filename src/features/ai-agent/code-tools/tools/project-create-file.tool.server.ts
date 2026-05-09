import type { CodeToolDefinition } from "../code-agent-types";
import { toolError, toolSuccess } from "../code-tool-executor.server";
import { ProjectPatchPolicyError, ProjectPatchService } from "../services/project-patch-service.server";

export function createProjectCreateFileTool(service = new ProjectPatchService()): CodeToolDefinition<{ path?: string; content?: string; reason?: string }> {
  return {
    name: "project_create_file",
    category: "mutate",
    description: "Create a new project file if it does not already exist.",
    strict: true,
    requiresInspection: true,
    requiresMutationLock: true,
    parametersJsonSchema: { type: "object", properties: { path: { type: "string" }, content: { type: "string" }, reason: { type: "string" } }, required: ["path", "content", "reason"], additionalProperties: false },
    handler: async ({ context, args }) => {
      const startedAt = Date.now();
      try {
        const result = await service.createFile({ workspaceRoot: context.workspaceRoot, relativePath: args.path ?? "", content: args.content ?? "" });
        Object.assign(context, { __codeToolChangedFiles: result.changedFiles });
        return toolSuccess({ context, toolName: "project_create_file", category: "mutate", startedAt, data: result });
      } catch (error) {
        if (error instanceof ProjectPatchPolicyError) return toolError(context, "project_create_file", "mutate", startedAt, error.code, error.message, true);
        throw error;
      }
    },
  };
}
