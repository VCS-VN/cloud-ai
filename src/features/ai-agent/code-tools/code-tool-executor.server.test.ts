/** @vitest-environment node */
import { describe, expect, it } from "vitest";
import type { CodeToolDefinition, ToolExecutionContext } from "./code-agent-types";
import { executeProjectTool } from "./code-tool-executor.server";
import type { CodeToolRegistry } from "./code-tool-registry.server";

const context = {
  userId: "user-1",
  projectId: "project-1",
  messageId: "message-1",
  workspaceRoot: "/tmp/project",
  projectState: {} as ToolExecutionContext["projectState"],
} satisfies ToolExecutionContext;

describe("executeProjectTool inspection gate", () => {
  it("rejects mutation tools before inspection", async () => {
    const mutateTool: CodeToolDefinition = {
      name: "project_apply_patch",
      category: "mutate",
      description: "Apply patch",
      parametersJsonSchema: { type: "object", additionalProperties: false, properties: {} },
      strict: true,
      requiresInspection: true,
      handler: async () => {
        throw new Error("should not execute");
      },
    };

    const registry = { get: (name: string) => (name === mutateTool.name ? mutateTool : undefined) } as CodeToolRegistry;
    const result = await executeProjectTool({
      registry,
      context,
      inspectionCompleted: false,
      mutationCompleted: false,
      toolCall: { callId: "call-1", name: "project_apply_patch", arguments: {} },
    });

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("INSPECTION_REQUIRED");
  });

  it("allows inspect tools before inspection", async () => {
    const inspectTool: CodeToolDefinition = {
      name: "project_get_context",
      category: "inspect",
      description: "Inspect context",
      parametersJsonSchema: { type: "object", additionalProperties: false, properties: {} },
      strict: true,
      handler: async ({ context }) => ({
        ok: true,
        data: { projectId: context.projectId },
        metadata: { toolName: "project_get_context", category: "inspect", projectId: context.projectId, messageId: context.messageId, durationMs: 0 },
      }),
    };

    const registry = { get: (name: string) => (name === inspectTool.name ? inspectTool : undefined) } as CodeToolRegistry;
    const result = await executeProjectTool({
      registry,
      context,
      inspectionCompleted: false,
      mutationCompleted: false,
      toolCall: { callId: "call-1", name: "project_get_context", arguments: {} },
    });

    expect(result.ok).toBe(true);
    expect(result.data).toEqual({ projectId: "project-1" });
  });
});
