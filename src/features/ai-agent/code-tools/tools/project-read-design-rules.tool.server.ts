import type { CodeToolDefinition } from "../code-agent-types";
import { toolSuccess, toolError } from "../code-tool-executor.server";
import { loadProjectDesignRules } from "../services/design-file-service.server";

export const projectReadDesignRulesTool: CodeToolDefinition<{}, { path: string; markdown: string; summary: string; hash: string }> = {
  name: "project_read_design_rules",
  category: "inspect",
  description:
    "Read the project's DESIGN.md storefront design rules. Returns markdown content, summary, and content hash. Must be called before UI mutations.",
  strict: true,
  parametersJsonSchema: {
    type: "object",
    additionalProperties: false,
    properties: {},
    required: [],
  },
  handler: async ({ context }) => {
    const startedAt = Date.now();
    try {
      const design = await loadProjectDesignRules({
        projectId: context.projectId,
        workspaceRoot: context.workspaceRoot,
      });

      (context as any).flags = { ...(context as any).flags, designRulesLoaded: true };
      (context as any).designRuleHash = design.hash;

      return toolSuccess({
        context,
        toolName: "project_read_design_rules",
        category: "inspect",
        startedAt,
        data: {
          path: design.path,
          markdown: design.markdown,
          summary: design.summary,
          hash: design.hash,
        },
      });
    } catch (error: any) {
      return toolError(
        context,
        "project_read_design_rules",
        "inspect",
        startedAt,
        error.code || "DESIGN_FILE_MISSING",
        error.message,
        false,
      ) as any;
    }
  },
};
