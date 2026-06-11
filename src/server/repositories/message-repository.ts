import { count, desc, asc, and, eq, lt, or } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type * as schema from "@/db/schema";
import { projectMessages } from "@/db/schema";
import type {
  AgentMessageKind,
  AgentQuestionMetadata,
  Message,
} from "@/shared/project-types";
import type { ProjectMessageRepository } from "@/shared/project-types";

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
    parentMessageId: row.parentMessageId ?? undefined,
    runId: row.runId ?? undefined,
    kind: (row.kind as AgentMessageKind | null) ?? undefined,
    metadata: (row.metadata as Message["metadata"] | null) ?? null,
    provider: row.provider ?? undefined,
    providerResponseId: row.providerResponseId ?? undefined,
    errorMessage: row.errorMessage ?? undefined,
    startedAt: row.startedAt?.toISOString(),
    completedAt: row.completedAt?.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt?.toISOString(),
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
        runId: message.runId,
        kind: message.kind,
        provider: message.provider,
        providerResponseId: message.providerResponseId,
        errorMessage: message.errorMessage,
        metadata: message.metadata ?? null,
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
        | "runId"
        | "kind"
        | "provider"
        | "providerResponseId"
        | "errorMessage"
        | "metadata"
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
      runId: "runId" in updates ? updates.runId ?? null : undefined,
      kind: "kind" in updates ? updates.kind ?? null : undefined,
      provider: "provider" in updates ? updates.provider ?? null : undefined,
      providerResponseId:
        "providerResponseId" in updates
          ? updates.providerResponseId ?? null
          : undefined,
      errorMessage:
        "errorMessage" in updates ? updates.errorMessage ?? null : undefined,
      metadata: "metadata" in updates ? updates.metadata ?? null : undefined,
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

  async markAgentQuestionAnswered(
    projectId: string,
    runId: string,
    selectedOptionId: string,
    userId?: string,
  ): Promise<Message | undefined> {
    const filter = userId
      ? and(
          eq(projectMessages.projectId, projectId),
          eq(projectMessages.runId, runId),
          eq(projectMessages.kind, "agent_question"),
          eq(projectMessages.userId, userId),
          eq(projectMessages.status, 1),
        )
      : and(
          eq(projectMessages.projectId, projectId),
          eq(projectMessages.runId, runId),
          eq(projectMessages.kind, "agent_question"),
          eq(projectMessages.status, 1),
        );

    const [existing] = await this.db
      .select()
      .from(projectMessages)
      .where(filter)
      .orderBy(desc(projectMessages.createdAt), desc(projectMessages.id))
      .limit(1);
    if (!existing) return undefined;

    const metadata = {
      ...((existing.metadata ?? {}) as Record<string, unknown>),
      selectedOptionId,
    } as AgentQuestionMetadata;

    const [row] = await this.db
      .update(projectMessages)
      .set({ metadata, updatedAt: new Date() })
      .where(eq(projectMessages.id, existing.id))
      .returning();
    return row ? toMessage(row) : undefined;
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

  async listMessagesByRunId(
    runId: string,
    userId?: string,
  ): Promise<Message[]> {
    const filter = userId
      ? and(
          eq(projectMessages.runId, runId),
          eq(projectMessages.userId, userId),
          eq(projectMessages.status, 1),
        )
      : and(
          eq(projectMessages.runId, runId),
          eq(projectMessages.status, 1),
        );

    const rows = await this.db
      .select()
      .from(projectMessages)
      .where(filter)
      .orderBy(asc(projectMessages.createdAt), asc(projectMessages.id));

    return rows.map(toMessage);
  }
}
