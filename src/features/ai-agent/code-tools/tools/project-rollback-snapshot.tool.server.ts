import type { CodeToolDefinition } from "../code-agent-types";
import { toolError, toolSuccess } from "../code-tool-executor.server";
import { ProjectSnapshotService, type ProjectSnapshotRecord } from "../services/project-snapshot-service.server";

export function createProjectRollbackSnapshotTool(service = new ProjectSnapshotService()): CodeToolDefinition<{ snapshotId?: string; reason?: string }> {
  return {
    name: "project_rollback_snapshot",
    category: "snapshot",
    description: "Rollback the workspace to a snapshot created during the current message run.",
    strict: true,
    parametersJsonSchema: { type: "object", properties: { snapshotId: { type: "string" }, reason: { type: "string" } }, required: ["snapshotId", "reason"], additionalProperties: false },
    handler: async ({ context, args }) => {
      const startedAt = Date.now();
      const snapshot = (context as unknown as { __codeToolSnapshot?: ProjectSnapshotRecord }).__codeToolSnapshot;
      if (!snapshot || snapshot.id !== args.snapshotId) return toolError(context, "project_rollback_snapshot", "snapshot", startedAt, "SNAPSHOT_NOT_FOUND", "Snapshot is not available for this message run.", true);
      const result = await service.rollbackSnapshot({ workspaceRoot: context.workspaceRoot, projectId: context.projectId, messageId: context.messageId, snapshot, reason: args.reason ?? "Rollback snapshot" });
      return toolSuccess({ context, toolName: "project_rollback_snapshot", category: "snapshot", startedAt, data: result });
    },
  };
}
