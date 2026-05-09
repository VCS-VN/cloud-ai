import type { PgProjectSnapshotRepository } from "@/server/repositories/project-snapshot-repository";
import type { FileManifestEntry, ProjectSnapshot, ProjectState } from "./project-state.schema";

export class SnapshotService {
  constructor(private readonly repository: PgProjectSnapshotRepository) {}

  async createSnapshot(args: {
    projectId: string;
    userId?: string;
    runId?: string;
    kind: ProjectSnapshot["kind"];
    summary: string;
    projectState: ProjectState;
    fileManifest?: FileManifestEntry[];
    workspaceRevisionId?: string;
  }) {
    return this.repository.save({
      id: crypto.randomUUID(),
      projectId: args.projectId,
      userId: args.userId,
      runId: args.runId,
      kind: args.kind,
      summary: args.summary,
      projectState: args.projectState,
      fileManifest: args.fileManifest ?? args.projectState.fileManifest,
      workspaceRevisionId: args.workspaceRevisionId,
      createdAt: new Date().toISOString(),
    });
  }

  async getLatestStable(projectId: string, userId?: string) {
    return this.repository.getLatestStable(projectId, userId);
  }

  async rollbackToLatestStable(args: {
    projectId: string;
    userId?: string;
    runId?: string;
    reason: string;
  }) {
    const stableSnapshot = await this.getLatestStable(args.projectId, args.userId);
    if (!stableSnapshot) return undefined;

    return this.createSnapshot({
      projectId: args.projectId,
      userId: args.userId,
      runId: args.runId,
      kind: "rollback",
      summary: `Rollback to latest stable snapshot: ${args.reason}`,
      projectState: stableSnapshot.projectState,
      fileManifest: stableSnapshot.fileManifest,
      workspaceRevisionId: stableSnapshot.workspaceRevisionId,
    });
  }
}
