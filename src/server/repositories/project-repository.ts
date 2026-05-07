import { eq, and, desc } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { projects } from "@/db/schema";
import type * as schema from "@/db/schema";
import type { Project, PwaConfig } from "@/shared/project-types";
import type { ProjectRepository } from "@/shared/project-types";

type ProjectRow = typeof projects.$inferSelect;

type ProjectDatabase = PostgresJsDatabase<typeof schema>;

function toProject(row: ProjectRow): Project {
  const data = (row.data as Partial<Project> | null) ?? {};
  return {
    ...data,
    id: row.id,
    userId: row.userId ?? undefined,
    name: row.name,
    description: row.description ?? undefined,
    initialPrompt: row.initialPrompt ?? data.initialPrompt ?? "",
    status: row.status === 0 ? 0 : (data.status ?? "ready"),
    processingStatus: (row.processingStatus as Project["processingStatus"]) ?? data.processingStatus ?? "idle",
    activeAgentMessageId:
      row.activeAgentMessageId ?? data.activeAgentMessageId ?? undefined,
    processingStartedAt:
      row.processingStartedAt?.toISOString() ??
      data.processingStartedAt ??
      undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    pwa: data.pwa ?? fallbackPwa(row.name),
  };
}

function fallbackPwa(name: string): PwaConfig {
  return {
    enabled: false,
    name,
    shortName: name.slice(0, 24) || "Project",
    themeColor: "#000000",
    backgroundColor: "#ffffff",
    display: "standalone",
    startUrl: "/",
    scope: "/",
    icons: [],
    offlineFallbackEnabled: false,
  };
}

export class PgProjectRepository implements ProjectRepository {
  constructor(private readonly db: ProjectDatabase) {}

  async saveProject(
    project: Project,
    userId?: string,
  ): Promise<Project> {
    const [row] = await this.db
      .insert(projects)
      .values({
        id: project.id,
        userId: userId ?? project.userId,
        name: project.name,
        description: project.description,
        initialPrompt: project.initialPrompt,
        status: project.status === 0 ? 0 : 1,
        processingStatus: project.processingStatus,
        activeAgentMessageId: project.activeAgentMessageId ?? null,
        processingStartedAt: project.processingStartedAt
          ? new Date(project.processingStartedAt)
          : null,
        currentRevisionId: null,
        data: project as unknown as Record<string, unknown>,
        createdAt: new Date(project.createdAt),
        updatedAt: new Date(project.updatedAt),
      })
      .onConflictDoUpdate({
        target: projects.id,
        set: {
          name: project.name,
          description: project.description,
          initialPrompt: project.initialPrompt,
          status: project.status === 0 ? 0 : 1,
          processingStatus: project.processingStatus,
          activeAgentMessageId: project.activeAgentMessageId ?? null,
          processingStartedAt: project.processingStartedAt
            ? new Date(project.processingStartedAt)
            : null,
          data: project as unknown as Record<string, unknown>,
          updatedAt: new Date(project.updatedAt),
        },
      })
      .returning();
    return toProject(row);
  }

  async getProject(
    id: string,
    userId?: string,
  ): Promise<Project | undefined> {
    let filter = and(
      eq(projects.id, id),
      eq(projects.status, 1),
    );
    if (userId) filter = and(filter, eq(projects.userId, userId));
    const [row] = await this.db.select().from(projects).where(filter);
    return row ? toProject(row) : undefined;
  }

  async listProjects(userId?: string): Promise<Project[]> {
    let filter: ReturnType<typeof eq> | ReturnType<typeof and> = eq(
      projects.status,
      1,
    );
    if (userId) filter = and(filter, eq(projects.userId, userId));
    const rows = await this.db
      .select()
      .from(projects)
      .where(filter)
      .orderBy(desc(projects.updatedAt));
    return rows.map(toProject);
  }

  async deleteProject(id: string, userId?: string): Promise<boolean> {
    let filter = and(
      eq(projects.id, id),
      eq(projects.status, 1),
    );
    if (userId) filter = and(filter, eq(projects.userId, userId));
    const [row] = await this.db
      .update(projects)
      .set({ status: 0 })
      .where(filter)
      .returning();
    return !!row;
  }

  async updateProjectProcessingState(
    id: string,
    processingStatus: Project["processingStatus"],
    userId?: string,
    activeAgentMessageId?: string,
    processingStartedAt?: string,
  ): Promise<Project | undefined> {
    let filter = and(
      eq(projects.id, id),
      eq(projects.status, 1),
    );
    if (userId) filter = and(filter, eq(projects.userId, userId));

    const [row] = await this.db
      .update(projects)
      .set({
        processingStatus,
        activeAgentMessageId: activeAgentMessageId ?? null,
        processingStartedAt: processingStartedAt
          ? new Date(processingStartedAt)
          : null,
        updatedAt: new Date(),
      })
      .where(filter)
      .returning();

    return row ? toProject(row) : undefined;
  }
}
