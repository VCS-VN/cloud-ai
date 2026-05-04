import { asc, and, eq } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { projectFileNodes } from '@/db/schema'
import type { ProjectFileNode } from '@/features/storefront-builder/types'
import type { ProjectFileNodeRepository } from './repositories'

type ProjectFileNodeRow = typeof projectFileNodes.$inferSelect

type ProjectFileNodeDatabase = PostgresJsDatabase<Record<string, never>>

function toFileNode(row: ProjectFileNodeRow): ProjectFileNode {
  return {
    id: row.id,
    userId: row.userId ?? undefined,
    projectId: row.projectId,
    name: row.name,
    type: row.type as ProjectFileNode['type'],
    path: row.path,
    parentId: row.parentId,
    contentType: row.contentType ?? undefined,
    content: row.content ?? undefined,
    metadata: (row.metadata as Record<string, string | number | boolean | null> | null) ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  }
}

export class PgProjectFileNodeRepository implements ProjectFileNodeRepository {
  constructor(private readonly db: ProjectFileNodeDatabase) {}

  async saveFileNode(node: ProjectFileNode, userId?: string): Promise<ProjectFileNode> {
    const [row] = await this.db
      .insert(projectFileNodes)
      .values({
        id: node.id,
        userId: userId ?? node.userId,
        projectId: node.projectId,
        name: node.name,
        type: node.type,
        path: node.path,
        parentId: node.parentId ?? null,
        contentType: node.contentType,
        content: node.content,
        metadata: node.metadata,
        createdAt: new Date(node.createdAt),
        updatedAt: new Date(node.updatedAt)
      })
      .returning()

    return toFileNode(row)
  }

  async getFileNode(projectId: string, nodeId: string, userId?: string): Promise<ProjectFileNode | undefined> {
    const filter = userId
      ? and(eq(projectFileNodes.projectId, projectId), eq(projectFileNodes.id, nodeId), eq(projectFileNodes.userId, userId))
      : and(eq(projectFileNodes.projectId, projectId), eq(projectFileNodes.id, nodeId))
    const [row] = await this.db.select().from(projectFileNodes).where(filter)
    return row ? toFileNode(row) : undefined
  }

  async listFileNodes(projectId: string, userId?: string): Promise<ProjectFileNode[]> {
    const filter = userId ? and(eq(projectFileNodes.projectId, projectId), eq(projectFileNodes.userId, userId)) : eq(projectFileNodes.projectId, projectId)
    const rows = await this.db.select().from(projectFileNodes).where(filter).orderBy(asc(projectFileNodes.path))
    return rows.map(toFileNode)
  }
}
