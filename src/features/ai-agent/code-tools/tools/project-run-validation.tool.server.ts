import type { CodeToolDefinition } from "../code-agent-types";
import { toolSuccess } from "../code-tool-executor.server";
import { runProjectValidation } from "../services/project-validation-service.server";
import type { AgentStreamEvent } from "../../agent/agent-events";

function emitValidationStdout(context: { stream?: { send: (event: unknown) => void | Promise<void> } }, toolName: string, text: string) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  for (const line of lines) {
    void context.stream?.send({ type: "tool_stdout", projectId: (context as any).projectId, messageId: (context as any).messageId, toolName, line } satisfies AgentStreamEvent);
  }
}

const VALIDATION_COMMANDS = {
  fast: ["pnpm run typecheck"],
  standard: ["pnpm run typecheck", "pnpm run lint"],
  full: ["pnpm run typecheck", "pnpm run lint", "pnpm run build"],
} as const;

export type ValidationLevel = keyof typeof VALIDATION_COMMANDS;

export function createProjectRunValidationTool(): CodeToolDefinition<{ level?: ValidationLevel; reason?: string }> {
  return {
    name: "project_run_validation",
    category: "validate",
    description: "Run safe allowlisted validation commands for the generated project at fast, standard, or full level.",
    strict: true,
    parametersJsonSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        level: { type: "string", enum: ["fast", "standard", "full"] },
        reason: { type: "string" },
      },
      required: ["level", "reason"],
    },
    handler: async ({ context, args }) => {
      const startedAt = Date.now();
      const level = args.level ?? "standard";
      const commands = VALIDATION_COMMANDS[level as ValidationLevel] ?? VALIDATION_COMMANDS.standard;
      const result = await runProjectValidation({
        workspaceRoot: context.workspaceRoot,
        commands: Array.from(commands),
        onStdout: (line) => emitValidationStdout(context, "project_run_validation", line),
        onStderr: (line) => emitValidationStdout(context, "project_run_validation", line),
      });
      return toolSuccess({ context, toolName: "project_run_validation", category: "validate", startedAt, data: { ...result, level } });
    },
  };
}
