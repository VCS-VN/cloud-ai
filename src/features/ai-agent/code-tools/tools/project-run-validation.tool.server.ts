import type { CodeToolDefinition } from "../code-agent-types";
import { toolSuccess } from "../code-tool-executor.server";
import { runProjectValidation } from "../services/project-validation-service.server";

export function createProjectRunValidationTool(): CodeToolDefinition<{ commands?: string[]; reason?: string }> {
  return {
    name: "project_run_validation",
    category: "validate",
    description: "Run safe allowlisted validation commands for the generated project.",
    strict: true,
    parametersJsonSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        commands: {
          type: "array",
          items: {
            type: "string",
            enum: ["npm run typecheck", "npm run lint", "npm run build", "npm test"],
          },
        },
        reason: { type: "string" },
      },
      required: ["commands", "reason"],
    },
    handler: async ({ context, args }) => {
      const startedAt = Date.now();
      const result = await runProjectValidation({
        workspaceRoot: context.workspaceRoot,
        commands: args.commands?.length ? args.commands : ["npm run typecheck", "npm run lint", "npm run build"],
      });
      return toolSuccess({ context, toolName: "project_run_validation", category: "validate", startedAt, data: result });
    },
  };
}
