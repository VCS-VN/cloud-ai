import { desc, and, eq, lt, or } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type * as schema from "@/db/schema";
import { projectMessages } from "@/db/schema";
import type { Message } from "@/shared/storefront-builder-types";
import type { ProjectMessageRepository } from "@/shared/storefront-builder-types";

type ProjectMessageRow = typeof projectMessages.$inferSelect;

type ProjectMessageDatabase = PostgresJsDatabase<typeof schema>;

function toMessage(row: ProjectMessageRow): Message {
  return {
    id: row.id,
    userId: row.userId ?? undefined,
    projectId: row.projectId,
    role: row.role as Message["role"],
    content: row.content,
    status: row.status === 0 ? 0 : "completed",
    processingStatus:
      (row.processingStatus as Message["processingStatus"]) ?? "completed",
    createdAt: row.createdAt.toISOString(),
  };
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
        status: message.status === 0 ? 0 : 1,
        processingStatus: message.processingStatus,
        createdAt: new Date(message.createdAt),
      })
      .returning();

    return toMessage(row);
  }

  async updateMessageStatus(
    id: string,
    status: Message["status"],
  ): Promise<Message | undefined> {
    const [row] = await this.db
      .update(projectMessages)
      .set({ status: status === 0 ? 0 : 1 })
      .where(eq(projectMessages.id, id))
      .returning();
    return row ? toMessage(row) : undefined;
  }

  async updateMessageProcessingStatus(
    id: string,
    processingStatus: Message["processingStatus"],
  ): Promise<Message | undefined> {
    const [row] = await this.db
      .update(projectMessages)
      .set({ processingStatus })
      .where(eq(projectMessages.id, id))
      .returning();
    return row ? toMessage(row) : undefined;
  }

  async bulkUpdateMessageStatusByProject(
    projectId: string,
    status: Message["status"],
    userId?: string,
  ): Promise<number> {
    const filter = userId
      ? and(
          eq(projectMessages.projectId, projectId),
          eq(projectMessages.userId, userId),
        )
      : eq(projectMessages.projectId, projectId);
    const rows = await this.db
      .update(projectMessages)
      .set({ status: status === 0 ? 0 : 1 })
      .where(filter)
      .returning({ id: projectMessages.id });
    return rows.length;
  }

  async listMessages(
    projectId: string,
    userId?: string,
    cursor?: import("@/shared/storefront-builder-types").MessageCursor,
  ): Promise<import("@/shared/storefront-builder-types").MessagePage> {
    const limit = cursor?.limit ?? 50;
    let filter = userId
      ? and(
          eq(projectMessages.projectId, projectId),
          eq(projectMessages.userId, userId),
          eq(projectMessages.status, 1),
        )
      : and(
          eq(projectMessages.projectId, projectId),
          eq(projectMessages.status, 1),
        );

    if (cursor?.beforeCreatedAt) {
      const date = new Date(cursor.beforeCreatedAt);
      if (cursor.beforeId) {
        filter = and(
          filter,
          or(
            lt(projectMessages.createdAt, date),
            and(
              eq(projectMessages.createdAt, date),
              lt(projectMessages.id, cursor.beforeId),
            ),
          ),
        );
      } else {
        filter = and(filter, lt(projectMessages.createdAt, date));
      }
    }

    const rows = await this.db
      .select()
      .from(projectMessages)
      .where(filter)
      .orderBy(desc(projectMessages.createdAt), desc(projectMessages.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    const nextCursor = hasMore
      ? {
          beforeCreatedAt: items[items.length - 1].createdAt.toISOString(),
          beforeId: items[items.length - 1].id,
        }
      : undefined;

    return {
      messages: items.map(toMessage).reverse(),
      nextCursor,
    };
  }
}
