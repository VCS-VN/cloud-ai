import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { CodeToolDefinition } from "../code-agent-types";
import { toolError, toolSuccess } from "../code-tool-executor.server";
import { ProjectPatchPolicyError, ProjectPatchService } from "../services/project-patch-service.server";
import {
  buildCssVariableMapping,
  replaceOwnedDesignTokenRegion,
} from "../services/design-token-mapping-service.server";
import { hashContent } from "../services/design-file-service.server";

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
            const appCssPath = path.join(context.workspaceRoot, "src/styles/app.css");
            const appCss = await readFile(appCssPath, "utf8");
            const mapping = buildCssVariableMapping(designContent);
            const mapped = replaceOwnedDesignTokenRegion(appCss, mapping);
            if (mapped.ok) {
              await writeFile(appCssPath, mapped.content, "utf8");
            } else {
              console.warn(`[project_create_file] app.css token patch skipped: ${mapped.message}`);
            }
            // stash hash so the orchestrator can record designState
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
