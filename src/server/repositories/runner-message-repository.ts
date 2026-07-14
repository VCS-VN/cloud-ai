import { asc, eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type * as schema from "@/db/schema";
import { runnerMessages } from "@/db/schema";
import type {
  AgentMessageKind,
  RunnerMessage,
  RunnerMessageRepository,
} from "@/shared/project-types";

type RunnerMessageRow = typeof runnerMessages.$inferSelect;

type RunnerMessageDatabase = PostgresJsDatabase<typeof schema>;

function toRunnerMessage(row: RunnerMessageRow): RunnerMessage {
  return {
    id: row.id,
    runId: row.runId,
    projectId: row.projectId,
    role: row.role as RunnerMessage["role"],
    content: row.content,
    kind: (row.kind as AgentMessageKind | null) ?? undefined,
    processingStatus:
      (row.processingStatus as RunnerMessage["processingStatus"]) ??
      "completed",
    metadata: (row.metadata as RunnerMessage["metadata"] | null) ?? null,
    providerResponseId: row.providerResponseId ?? undefined,
    errorMessage: row.errorMessage ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt?.toISOString(),
  };
}

export class PgRunnerMessageRepository implements RunnerMessageRepository {
  constructor(private readonly db: RunnerMessageDatabase) {}

  async saveRunnerMessage(message: RunnerMessage): Promise<RunnerMessage> {
    const [row] = await this.db
      .insert(runnerMessages)
      .values({
        id: message.id,
        runId: message.runId,
        projectId: message.projectId,
        role: message.role,
        content: message.content,
        kind: message.kind,
        processingStatus: message.processingStatus,
        metadata: message.metadata ?? null,
        providerResponseId: message.providerResponseId,
        errorMessage: message.errorMessage,
        createdAt: new Date(message.createdAt),
        updatedAt: message.updatedAt ? new Date(message.updatedAt) : null,
      })
      .returning();

    return toRunnerMessage(row);
  }

  async updateRunnerMessage(
    id: string,
    updates: Partial<
      Pick<
        RunnerMessage,
        | "content"
        | "kind"
        | "processingStatus"
        | "metadata"
        | "providerResponseId"
        | "errorMessage"
        | "updatedAt"
      >
    >,
  ): Promise<RunnerMessage | undefined> {
    const nextValues = {
      content: updates.content,
      kind: "kind" in updates ? updates.kind ?? null : undefined,
      processingStatus: updates.processingStatus,
      metadata: "metadata" in updates ? updates.metadata ?? null : undefined,
      providerResponseId:
        "providerResponseId" in updates
          ? updates.providerResponseId ?? null
          : undefined,
      errorMessage:
        "errorMessage" in updates ? updates.errorMessage ?? null : undefined,
      updatedAt: updates.updatedAt ? new Date(updates.updatedAt) : new Date(),
    };

    const [row] = await this.db
      .update(runnerMessages)
      .set(nextValues)
      .where(eq(runnerMessages.id, id))
      .returning();
    return row ? toRunnerMessage(row) : undefined;
  }

  async listRunnerMessagesByRunId(runId: string): Promise<RunnerMessage[]> {
    const rows = await this.db
      .select()
      .from(runnerMessages)
      .where(eq(runnerMessages.runId, runId))
      .orderBy(asc(runnerMessages.createdAt), asc(runnerMessages.id));

    return rows.map(toRunnerMessage);
  }
}
