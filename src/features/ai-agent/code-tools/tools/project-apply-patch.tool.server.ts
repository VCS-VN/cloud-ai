import type { CodeToolDefinition } from "../code-agent-types";
import { toolError, toolSuccess } from "../code-tool-executor.server";
import { ProjectPatchPolicyError, ProjectPatchService } from "../services/project-patch-service.server";
import { patchAppCssFromDesignSource } from "../services/design-app-css-patch.server";
import { hashContent } from "../services/design-file-service.server";

/** @deprecated Use editTool instead. Remove after 2026-07-01. */
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
        if (result.changedFiles.includes("DESIGN.md")) {
          try {
            const { readFile } = await import("node:fs/promises");
            const { join } = await import("node:path");
            const designContent = await readFile(join(context.workspaceRoot, "DESIGN.md"), "utf8");
            const patched = await patchAppCssFromDesignSource(context.workspaceRoot, designContent);
            if (!patched.ok) {
              console.warn(`[project_apply_patch] app.css token patch skipped: ${patched.message}`);
            }
            Object.assign(context, { __designSourceHash: hashContent(designContent) });
          } catch (err) {
            console.warn(`[project_apply_patch] DESIGN.md post-patch hook failed (non-fatal):`, err);
          }
        }
        return toolSuccess({ context, toolName: "project_apply_patch", category: "mutate", startedAt, data: result });
      } catch (error) {
        if (error instanceof ProjectPatchPolicyError) return toolError(context, "project_apply_patch", "mutate", startedAt, error.code, error.message, true);
        throw error;
      }
    },
  };
}
