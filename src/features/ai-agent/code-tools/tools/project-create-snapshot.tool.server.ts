import type { CodeToolDefinition } from "../code-agent-types";
import { toolSuccess } from "../code-tool-executor.server";
import { ProjectSnapshotService } from "../services/project-snapshot-service.server";

export function createProjectCreateSnapshotTool(service = new ProjectSnapshotService()): CodeToolDefinition<{ reason?: string }> {
  return {
    name: "project_create_snapshot",
    category: "snapshot",
    description: "Create a rollback snapshot for the current message run before code mutation.",
    strict: true,
    parametersJsonSchema: { type: "object", properties: { reason: { type: "string" } }, required: ["reason"], additionalProperties: false },
    handler: async ({ context, args }) => {
      const startedAt = Date.now();
      const snapshot = await service.createSnapshot({ workspaceRoot: context.workspaceRoot, projectId: context.projectId, messageId: context.messageId, reason: args.reason ?? "Before mutation" });
      Object.assign(context, { __codeToolSnapshot: snapshot, __codeToolSnapshotId: snapshot.id });
      return toolSuccess({ context, toolName: "project_create_snapshot", category: "snapshot", startedAt, data: { snapshotId: snapshot.id, createdAt: snapshot.createdAt } });
    },
  };
}
