import { and, desc, eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { projectSnapshots } from "@/db/schema";
import type * as schema from "@/db/schema";
import type { ProjectSnapshot, ProjectState } from "@/features/ai-agent/project/project-state.schema";

type SnapshotDatabase = PostgresJsDatabase<typeof schema>;
type SnapshotRow = typeof projectSnapshots.$inferSelect;

function toSnapshot(row: SnapshotRow): ProjectSnapshot {
  return {
    id: row.id,
    projectId: row.projectId,
    userId: row.userId ?? undefined,
    runId: row.runId ?? undefined,
    kind: row.kind as ProjectSnapshot["kind"],
    summary: row.summary,
    projectState: row.projectState as ProjectState,
    fileManifest: row.fileManifest as ProjectSnapshot["fileManifest"],
    workspaceRevisionId: row.workspaceRevisionId ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

export class PgProjectSnapshotRepository {
  constructor(private readonly db: SnapshotDatabase) {}

  async save(snapshot: ProjectSnapshot): Promise<ProjectSnapshot> {
    const [row] = await this.db.insert(projectSnapshots).values({
      id: snapshot.id,
      projectId: snapshot.projectId,
      userId: snapshot.userId,
      runId: snapshot.runId,
      kind: snapshot.kind,
      summary: snapshot.summary,
      projectState: snapshot.projectState,
      fileManifest: snapshot.fileManifest,
      workspaceRevisionId: snapshot.workspaceRevisionId,
      createdAt: new Date(snapshot.createdAt),
    }).returning();
    return toSnapshot(row);
  }

  async listByProject(projectId: string, userId?: string): Promise<ProjectSnapshot[]> {
    const filter = userId
      ? and(eq(projectSnapshots.projectId, projectId), eq(projectSnapshots.userId, userId))
      : eq(projectSnapshots.projectId, projectId);
    const rows = await this.db.select().from(projectSnapshots).where(filter).orderBy(desc(projectSnapshots.createdAt));
    return rows.map(toSnapshot);
  }

  async getLatestStable(projectId: string, userId?: string): Promise<ProjectSnapshot | undefined> {
    const snapshots = await this.listByProject(projectId, userId);
    return snapshots.find((snapshot) => snapshot.kind === "post_change" || snapshot.kind === "initial");
  }
}
