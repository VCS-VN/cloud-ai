import { eq, and, desc } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { storefrontProjects } from "@/db/schema";
import type * as schema from "@/db/schema";
import type { Project, PwaConfig } from "@/shared/storefront-builder-types";
import type { StorefrontBuilderProjectRepository } from "@/shared/storefront-builder-types";

type StorefrontProjectRow = typeof storefrontProjects.$inferSelect;

type StorefrontProjectDatabase = PostgresJsDatabase<typeof schema>;

function toProject(row: StorefrontProjectRow): Project {
  const data = (row.data as Partial<Project> | null) ?? {};
  return {
    ...data,
    id: row.id,
    userId: row.userId ?? undefined,
    name: row.name,
    description: row.description ?? undefined,
    initialPrompt: row.initialPrompt ?? data.initialPrompt ?? "",
    status: row.status === 0 ? 0 : (data.status ?? "ready"),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    pwa: data.pwa ?? fallbackPwa(row.name),
  };
}

function fallbackPwa(name: string): PwaConfig {
  return {
    enabled: false,
    name,
    shortName: name.slice(0, 24) || "Storefront",
    themeColor: "#000000",
    backgroundColor: "#ffffff",
    display: "standalone",
    startUrl: "/",
    scope: "/",
    icons: [],
    offlineFallbackEnabled: false,
  };
}

export class PgStorefrontBuilderProjectRepository implements StorefrontBuilderProjectRepository {
  constructor(private readonly db: StorefrontProjectDatabase) {}

  async saveBuilderProject(
    project: Project,
    userId?: string,
  ): Promise<Project> {
    const [row] = await this.db
      .insert(storefrontProjects)
      .values({
        id: project.id,
        userId: userId ?? project.userId,
        name: project.name,
        description: project.description,
        initialPrompt: project.initialPrompt,
        status: project.status === 0 ? 0 : 1,
        currentRevisionId: null,
        data: project as unknown as Record<string, unknown>,
        createdAt: new Date(project.createdAt),
        updatedAt: new Date(project.updatedAt),
      })
      .onConflictDoUpdate({
        target: storefrontProjects.id,
        set: {
          name: project.name,
          description: project.description,
          initialPrompt: project.initialPrompt,
          status: project.status === 0 ? 0 : 1,
          data: project as unknown as Record<string, unknown>,
          updatedAt: new Date(project.updatedAt),
        },
      })
      .returning();
    return toProject(row);
  }

  async getBuilderProject(
    id: string,
    userId?: string,
  ): Promise<Project | undefined> {
    let filter = and(
      eq(storefrontProjects.id, id),
      eq(storefrontProjects.status, 1),
    );
    if (userId) filter = and(filter, eq(storefrontProjects.userId, userId));
    const [row] = await this.db.select().from(storefrontProjects).where(filter);
    return row ? toProject(row) : undefined;
  }

  async listBuilderProjects(userId?: string): Promise<Project[]> {
    let filter: ReturnType<typeof eq> | ReturnType<typeof and> = eq(
      storefrontProjects.status,
      1,
    );
    if (userId) filter = and(filter, eq(storefrontProjects.userId, userId));
    const rows = await this.db
      .select()
      .from(storefrontProjects)
      .where(filter)
      .orderBy(desc(storefrontProjects.updatedAt));
    return rows.map(toProject);
  }

  async deleteBuilderProject(id: string, userId?: string): Promise<boolean> {
    let filter = and(
      eq(storefrontProjects.id, id),
      eq(storefrontProjects.status, 1),
    );
    if (userId) filter = and(filter, eq(storefrontProjects.userId, userId));
    const [row] = await this.db
      .update(storefrontProjects)
      .set({ status: 0 })
      .where(filter)
      .returning();
    return !!row;
  }
}
