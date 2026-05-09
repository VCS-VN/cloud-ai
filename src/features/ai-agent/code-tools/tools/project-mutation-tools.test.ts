import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { ProjectState } from "../../project/project-state.schema";
import type { ToolExecutionContext } from "../code-agent-types";
import { executeProjectTool } from "../code-tool-executor.server";
import { CodeToolRegistry, registerMutationAndSnapshotTools } from "../code-tool-registry.server";

function context(workspaceRoot: string): ToolExecutionContext {
  return { userId: "user_1", projectId: "project_1", messageId: "msg_1", workspaceRoot, projectState: {} as ProjectState };
}

describe("mutation tools", () => {
  it("requires a snapshot before mutation", async () => {
    const registry = registerMutationAndSnapshotTools(new CodeToolRegistry());
    const result = await executeProjectTool({ registry, context: context(await mkdtemp(path.join(os.tmpdir(), "mutation-tools-"))), inspectionCompleted: true, mutationCompleted: false, toolCall: { callId: "call_1", name: "project_create_file", arguments: { path: "src/a.ts", content: "export {}", reason: "test" } } });
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("SNAPSHOT_REQUIRED");
  });

  it("creates a snapshot, creates a file, and returns diff summary", async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "mutation-tools-"));
    const registry = registerMutationAndSnapshotTools(new CodeToolRegistry());
    const toolContext = context(workspaceRoot);

    const snapshot = await executeProjectTool({ registry, context: toolContext, inspectionCompleted: true, mutationCompleted: false, toolCall: { callId: "call_1", name: "project_create_snapshot", arguments: { reason: "before" } } });
    expect(snapshot.ok).toBe(true);

    const create = await executeProjectTool({ registry, context: toolContext, inspectionCompleted: true, mutationCompleted: false, toolCall: { callId: "call_2", name: "project_create_file", arguments: { path: "src/a.ts", content: "export const a = 1", reason: "test" } } });
    expect(create.ok).toBe(true);

    const diff = await executeProjectTool({ registry, context: toolContext, inspectionCompleted: true, mutationCompleted: true, toolCall: { callId: "call_3", name: "project_get_diff", arguments: { includePatch: false, maxBytes: 1000 } } });
    expect(diff.data).toMatchObject({ changedFiles: ["src/a.ts"] });
  });

  it("applies patch contract errors as recoverable tool failures", async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "mutation-tools-"));
    await writeFile(path.join(workspaceRoot, "app.ts"), "before\n", "utf8");
    const registry = registerMutationAndSnapshotTools(new CodeToolRegistry());
    const toolContext = context(workspaceRoot);
    await executeProjectTool({ registry, context: toolContext, inspectionCompleted: true, mutationCompleted: false, toolCall: { callId: "call_1", name: "project_create_snapshot", arguments: { reason: "before" } } });

    const result = await executeProjectTool({ registry, context: toolContext, inspectionCompleted: true, mutationCompleted: false, toolCall: { callId: "call_2", name: "project_apply_patch", arguments: { patch: "--- a/package.json\n+++ b/package.json\n@@\n+{}", reason: "bad", expectedChangedFiles: ["package.json"] } } });
    expect(result.ok).toBe(false);
    expect(result.error).toMatchObject({ code: "PACKAGE_POLICY_VIOLATION", recoverable: true });
  });
});
