import { asc, and, eq } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { projectMessages } from '../db/schema'
import type { Message } from '../features/storefront-builder/types'
import type { ProjectMessageRepository } from './repositories'

type ProjectMessageRow = typeof projectMessages.$inferSelect

type ProjectMessageDatabase = PostgresJsDatabase<Record<string, never>>

function toMessage(row: ProjectMessageRow): Message {
  return {
    id: row.id,
    userId: row.userId ?? undefined,
    projectId: row.projectId,
    role: row.role as Message['role'],
    content: row.content,
    status: row.status as Message['status'],
    createdAt: row.createdAt.toISOString()
  }
}

export class PgProjectMessageRepository implements ProjectMessageRepository {
  constructor(private readonly db: ProjectMessageDatabase) {}

  async saveMessage(message: Message, userId?: string): Promise<Message> {
    const [row] = await this.db
      .insert(projectMessages)
      .values({
        id: message.id,
        userId: userId ?? message.userId,
        projectId: message.projectId,
        role: message.role,
        content: message.content,
        status: message.status,
        createdAt: new Date(message.createdAt)
      })
      .returning()

    return toMessage(row)
  }

  async updateMessageStatus(id: string, status: Message['status']): Promise<Message | undefined> {
    const [row] = await this.db.update(projectMessages).set({ status }).where(eq(projectMessages.id, id)).returning()
    return row ? toMessage(row) : undefined
  }

  async listMessages(projectId: string, userId?: string): Promise<Message[]> {
    const filter = userId ? and(eq(projectMessages.projectId, projectId), eq(projectMessages.userId, userId)) : eq(projectMessages.projectId, projectId)
    const rows = await this.db.select().from(projectMessages).where(filter).orderBy(asc(projectMessages.createdAt))
    return rows.map(toMessage)
  }
}
