import { and, eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { projectStates } from "@/db/schema";
import type * as schema from "@/db/schema";
import type { ProjectState, ProjectStateStatus } from "@/features/ai-agent/project/project-state.schema";

type ProjectStateDatabase = PostgresJsDatabase<typeof schema>;
type ProjectStateRow = typeof projectStates.$inferSelect;

type ProjectStateRecord = ProjectState & {
  id: string;
  userId?: string;
  createdAt: string;
  updatedAt: string;
};

function toRecord(row: ProjectStateRow): ProjectStateRecord {
  return {
    id: row.id,
    userId: row.userId ?? undefined,
    projectId: row.projectId,
    status: row.status as ProjectStateStatus,
    stack: row.stack as ProjectState["stack"],
    packagePolicy: row.packagePolicy as ProjectState["packagePolicy"],
    ecommerceSpec: row.ecommerceSpec as ProjectState["ecommerceSpec"],
    brand: row.brand as ProjectState["brand"],
    pages: row.pages as ProjectState["pages"],
    features: row.features as ProjectState["features"],
    constraints: row.constraints as ProjectState["constraints"],
    fileManifest: row.fileManifest as ProjectState["fileManifest"],
    decisionLog: row.decisionLog as ProjectState["decisionLog"],
    recentChanges: row.recentChanges as ProjectState["recentChanges"],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class PgProjectStateRepository {
  constructor(private readonly db: ProjectStateDatabase) {}

  async save(record: ProjectStateRecord): Promise<ProjectStateRecord> {
    const values = {
      id: record.id,
      projectId: record.projectId,
      userId: record.userId,
      status: record.status,
      stack: record.stack,
      packagePolicy: record.packagePolicy,
      ecommerceSpec: record.ecommerceSpec,
      brand: record.brand,
      pages: record.pages,
      features: record.features,
      constraints: record.constraints,
      fileManifest: record.fileManifest,
      decisionLog: record.decisionLog,
      recentChanges: record.recentChanges,
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt),
    };
    const [row] = await this.db
      .insert(projectStates)
      .values(values)
      .onConflictDoUpdate({
        target: projectStates.projectId,
        set: { ...values, id: undefined, projectId: undefined, createdAt: undefined },
      })
      .returning();
    return toRecord(row);
  }

  async getByProjectId(projectId: string, userId?: string): Promise<ProjectStateRecord | undefined> {
    const filter = userId
      ? and(eq(projectStates.projectId, projectId), eq(projectStates.userId, userId))
      : eq(projectStates.projectId, projectId);
    const [row] = await this.db.select().from(projectStates).where(filter);
    return row ? toRecord(row) : undefined;
  }
}

export type { ProjectStateRecord };
