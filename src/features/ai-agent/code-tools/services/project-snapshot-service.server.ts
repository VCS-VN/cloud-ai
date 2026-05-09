import { cp, mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";

export type ProjectSnapshotRecord = {
  id: string;
  projectId: string;
  messageId: string;
  reason: string;
  snapshotPath: string;
  createdAt: string;
};

export class ProjectSnapshotService {
  async createSnapshot(input: { workspaceRoot: string; projectId: string; messageId: string; reason: string }): Promise<ProjectSnapshotRecord> {
    const id = `snap_${crypto.randomUUID()}`;
    const snapshotPath = path.join(path.dirname(input.workspaceRoot), `.agent-snapshots-${path.basename(input.workspaceRoot)}`, input.messageId, id);
    await mkdir(path.dirname(snapshotPath), { recursive: true });
    await cp(input.workspaceRoot, snapshotPath, { recursive: true });
    return { id, projectId: input.projectId, messageId: input.messageId, reason: input.reason, snapshotPath, createdAt: new Date().toISOString() };
  }

  async rollbackSnapshot(input: { workspaceRoot: string; projectId: string; messageId: string; snapshot: ProjectSnapshotRecord; reason: string }) {
    if (input.snapshot.projectId !== input.projectId || input.snapshot.messageId !== input.messageId) {
      throw new Error("Snapshot does not belong to the current message run.");
    }
    await stat(input.snapshot.snapshotPath);
    await rm(input.workspaceRoot, { recursive: true, force: true });
    await mkdir(input.workspaceRoot, { recursive: true });
    await cp(input.snapshot.snapshotPath, input.workspaceRoot, { recursive: true });
    return { snapshotId: input.snapshot.id, restoredFiles: [], reason: input.reason };
  }
}
