import { asc, eq } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { projectMessages } from '../db/schema'
import type { Message } from '../features/storefront-builder/types'
import type { ProjectMessageRepository } from './repositories'

type ProjectMessageRow = typeof projectMessages.$inferSelect

type ProjectMessageDatabase = PostgresJsDatabase<Record<string, never>>

function toMessage(row: ProjectMessageRow): Message {
  return {
    id: row.id,
    projectId: row.projectId,
    role: row.role as Message['role'],
    content: row.content,
    status: row.status as Message['status'],
    createdAt: row.createdAt.toISOString()
  }
}

export class PgProjectMessageRepository implements ProjectMessageRepository {
  constructor(private readonly db: ProjectMessageDatabase) {}

  async saveMessage(message: Message): Promise<Message> {
    const [row] = await this.db
      .insert(projectMessages)
      .values({
        id: message.id,
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

  async listMessages(projectId: string): Promise<Message[]> {
    const rows = await this.db
      .select()
      .from(projectMessages)
      .where(eq(projectMessages.projectId, projectId))
      .orderBy(asc(projectMessages.createdAt))

    return rows.map(toMessage)
  }
}
