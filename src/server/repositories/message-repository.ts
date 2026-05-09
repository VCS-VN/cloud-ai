import { count, desc, and, eq, lt, or } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type * as schema from "@/db/schema";
import { agentMessageChunks, projectMessages } from "@/db/schema";
import type {
  AgentMessageChunk,
  Message,
} from "@/shared/project-types";
import type { ProjectMessageRepository } from "@/shared/project-types";

type ProjectMessageRow = typeof projectMessages.$inferSelect;
type AgentMessageChunkRow = typeof agentMessageChunks.$inferSelect;

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
    parentMessageId: row.parentMessageId ?? undefined,
    provider: row.provider ?? undefined,
    providerResponseId: row.providerResponseId ?? undefined,
    errorMessage: row.errorMessage ?? undefined,
    startedAt: row.startedAt?.toISOString(),
    completedAt: row.completedAt?.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt?.toISOString(),
  };
}

function toAgentMessageChunk(row: AgentMessageChunkRow): AgentMessageChunk {
  return {
    id: row.id,
    projectId: row.projectId,
    messageId: row.messageId,
    userId: row.userId ?? undefined,
    sequence: row.sequence,
    content: row.content,
    providerEventType: row.providerEventType ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

function toOptionalDate(value?: string) {
  return value ? new Date(value) : null;
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
        parentMessageId: message.parentMessageId,
        provider: message.provider,
        providerResponseId: message.providerResponseId,
        errorMessage: message.errorMessage,
        startedAt: message.startedAt ? new Date(message.startedAt) : null,
        completedAt: message.completedAt ? new Date(message.completedAt) : null,
        createdAt: new Date(message.createdAt),
        updatedAt: message.updatedAt ? new Date(message.updatedAt) : null,
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
      .set({ processingStatus, updatedAt: new Date() })
      .where(eq(projectMessages.id, id))
      .returning();
    return row ? toMessage(row) : undefined;
  }

  async updateMessage(
    id: string,
    updates: Partial<
      Pick<
        Message,
        | "content"
        | "processingStatus"
        | "parentMessageId"
        | "provider"
        | "providerResponseId"
        | "errorMessage"
        | "startedAt"
        | "completedAt"
        | "updatedAt"
      >
    >,
  ): Promise<Message | undefined> {
    const nextValues = {
      content: updates.content,
      processingStatus: updates.processingStatus,
      parentMessageId:
        "parentMessageId" in updates ? updates.parentMessageId ?? null : undefined,
      provider: "provider" in updates ? updates.provider ?? null : undefined,
      providerResponseId:
        "providerResponseId" in updates
          ? updates.providerResponseId ?? null
          : undefined,
      errorMessage:
        "errorMessage" in updates ? updates.errorMessage ?? null : undefined,
      startedAt:
        "startedAt" in updates ? toOptionalDate(updates.startedAt) : undefined,
      completedAt:
        "completedAt" in updates
          ? toOptionalDate(updates.completedAt)
          : undefined,
      updatedAt: updates.updatedAt ? new Date(updates.updatedAt) : new Date(),
    };

    const [row] = await this.db
      .update(projectMessages)
      .set(nextValues)
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
    cursor?: import("@/shared/project-types").MessageCursor,
  ): Promise<import("@/shared/project-types").MessagePage> {
    const limit = cursor?.limit ?? 50;
    const baseFilter = userId
      ? and(
          eq(projectMessages.projectId, projectId),
          eq(projectMessages.userId, userId),
          eq(projectMessages.status, 1),
        )
      : and(
          eq(projectMessages.projectId, projectId),
          eq(projectMessages.status, 1),
        );
    let filter = baseFilter;

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

    const [rows, totalResult] = await Promise.all([
      this.db
        .select()
        .from(projectMessages)
        .where(filter)
        .orderBy(desc(projectMessages.createdAt), desc(projectMessages.id))
        .limit(limit + 1),
      this.db
        .select({ value: count() })
        .from(projectMessages)
        .where(baseFilter),
    ]);

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
      total: totalResult[0]?.value ?? 0,
    };
  }

  async getMessage(
    projectId: string,
    messageId: string,
    userId?: string,
  ): Promise<Message | undefined> {
    let filter = and(
      eq(projectMessages.projectId, projectId),
      eq(projectMessages.id, messageId),
      eq(projectMessages.status, 1),
    );
    if (userId) filter = and(filter, eq(projectMessages.userId, userId));

    const [row] = await this.db.select().from(projectMessages).where(filter);
    return row ? toMessage(row) : undefined;
  }

  async saveAgentMessageChunk(
    chunk: AgentMessageChunk,
    userId?: string,
  ): Promise<AgentMessageChunk> {
    const [row] = await this.db
      .insert(agentMessageChunks)
      .values({
        id: chunk.id,
        projectId: chunk.projectId,
        messageId: chunk.messageId,
        userId: userId ?? chunk.userId,
        sequence: chunk.sequence,
        content: chunk.content,
        providerEventType: chunk.providerEventType,
        createdAt: new Date(chunk.createdAt),
      })
      .onConflictDoNothing({
        target: [agentMessageChunks.messageId, agentMessageChunks.sequence],
      })
      .returning();

    if (row) return toAgentMessageChunk(row);

    const [existingRow] = await this.db
      .select()
      .from(agentMessageChunks)
      .where(
        and(
          eq(agentMessageChunks.messageId, chunk.messageId),
          eq(agentMessageChunks.sequence, chunk.sequence),
        ),
      );

    if (!existingRow) throw new Error("Agent message chunk conflict could not be resolved.");
    return toAgentMessageChunk(existingRow);
  }

  async listAgentMessageChunks(
    messageId: string,
    userId?: string,
  ): Promise<AgentMessageChunk[]> {
    const filter = userId
      ? and(
          eq(agentMessageChunks.messageId, messageId),
          eq(agentMessageChunks.userId, userId),
        )
      : eq(agentMessageChunks.messageId, messageId);

    const rows = await this.db
      .select()
      .from(agentMessageChunks)
      .where(filter)
      .orderBy(agentMessageChunks.sequence);

    return rows.map(toAgentMessageChunk);
  }
}
