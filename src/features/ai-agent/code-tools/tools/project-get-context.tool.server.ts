import type { CodeToolDefinition } from "../code-agent-types";
import { toolSuccess } from "../code-tool-executor.server";
import { redactToolData } from "../services/secret-redaction.server";

export const projectGetContextTool: CodeToolDefinition<{ includeRecentChanges?: boolean; includePackagePolicy?: boolean; includePreviewStatus?: boolean }> = {
  name: "project_get_context",
  category: "inspect",
  description: "Return trusted generated project context, stack, package policy, and recent safe changes.",
  strict: true,
  parametersJsonSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      includeRecentChanges: { type: "boolean" },
      includePackagePolicy: { type: "boolean" },
      includePreviewStatus: { type: "boolean" },
    },
  },
  handler: async ({ context, args }) => {
    const startedAt = Date.now();
    const state = context.projectState;
    return toolSuccess({
      context,
      toolName: "project_get_context",
      category: "inspect",
      startedAt,
      data: redactToolData({
        projectId: context.projectId,
        summary: `${state.brand.name} ${state.ecommerceSpec.storeType} storefront using ${state.stack.framework}.`,
        stack: state.stack,
        pages: state.pages,
        fileManifest: state.fileManifest,
        constraints: state.constraints,
        recentChanges: args.includeRecentChanges ? state.recentChanges.slice(0, 5) : undefined,
        packagePolicy: args.includePackagePolicy ? state.packagePolicy : undefined,
        previewStatus: args.includePreviewStatus ? { status: state.status } : undefined,
      }),
    });
  },
};
