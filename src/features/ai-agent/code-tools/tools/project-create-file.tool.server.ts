import type { CodeToolDefinition } from "../code-agent-types";
import { toolError, toolSuccess } from "../code-tool-executor.server";
import { ProjectPatchPolicyError, ProjectPatchService } from "../services/project-patch-service.server";
import { patchAppCssFromDesignSource } from "../services/design-app-css-patch.server";
import { hashContent } from "../services/design-file-service.server";

/** @deprecated Use writeTool instead. Remove after 2026-07-01. */
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
        if ((args.path ?? "") === "DESIGN.md") {
          try {
            const designContent = args.content ?? "";
            const patched = await patchAppCssFromDesignSource(
              context.workspaceRoot,
              designContent,
            );
            if (!patched.ok) {
              console.warn(
                `[project_create_file] app.css token patch skipped: ${patched.message}`,
              );
            }
            Object.assign(context, { __designSourceHash: hashContent(designContent) });
          } catch (err) {
            console.warn(`[project_create_file] DESIGN.md post-write hook failed (non-fatal):`, err);
          }
        }
        return toolSuccess({ context, toolName: "project_create_file", category: "mutate", startedAt, data: result });
      } catch (error) {
        if (error instanceof ProjectPatchPolicyError) return toolError(context, "project_create_file", "mutate", startedAt, error.code, error.message, true);
        throw error;
      }
    },
  };
}
