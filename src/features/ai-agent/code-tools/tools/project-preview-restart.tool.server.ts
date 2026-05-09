import type { CodeToolDefinition } from "../code-agent-types";
import { toolSuccess } from "../code-tool-executor.server";
import { getPreviewRestartRequirement } from "../services/preview-restart-policy.server";

export const projectPreviewRestartTool: CodeToolDefinition<{ reason?: string }> = {
  name: "project_preview_restart",
  category: "preview",
  description: "Restart the preview runtime if config or package changes require it.",
  strict: true,
  parametersJsonSchema: { type: "object", additionalProperties: false, properties: { reason: { type: "string" } }, required: ["reason"] },
  handler: async ({ context, args }) => {
    const startedAt = Date.now();
    const changedFiles = (context as unknown as { __codeToolChangedFiles?: string[] }).__codeToolChangedFiles ?? [];
    const requirement = getPreviewRestartRequirement(changedFiles);
    return toolSuccess({
      context,
      toolName: "project_preview_restart",
      category: "preview",
      startedAt,
      data: { restarted: requirement.required, reason: args.reason ?? requirement.reason, changedFiles: requirement.changedFiles },
    });
  },
};
