import type { CodeToolDefinition } from "../code-agent-types";
import { toolSuccess } from "../code-tool-executor.server";

export const projectPreviewStatusTool: CodeToolDefinition<{}> = {
  name: "project_preview_status",
  category: "preview",
  description: "Return the current preview runtime status for the generated project.",
  strict: true,
  parametersJsonSchema: { type: "object", additionalProperties: false },
  handler: async ({ context }) => {
    const startedAt = Date.now();
    return toolSuccess({
      context,
      toolName: "project_preview_status",
      category: "preview",
      startedAt,
      data: { status: "unknown", previewUrl: undefined },
    });
  },
};
