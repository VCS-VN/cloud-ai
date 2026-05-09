import { and, desc, eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { agentRuns } from "@/db/schema";
import type * as schema from "@/db/schema";
import type { AgentRun, AgentRunStatus, BuilderIntent, ChangePlan, ValidationResult } from "@/features/ai-agent/project/project-state.schema";

type AgentRunDatabase = PostgresJsDatabase<typeof schema>;
type AgentRunRow = typeof agentRuns.$inferSelect;

function toRun(row: AgentRunRow): AgentRun {
  return {
    id: row.id,
    projectId: row.projectId,
    userId: row.userId ?? undefined,
    messageId: row.messageId ?? undefined,
    parentMessageId: row.parentMessageId ?? undefined,
    userPrompt: row.userPrompt,
    intent: row.intent as BuilderIntent | undefined,
    plan: row.plan as ChangePlan | undefined,
    status: row.status as AgentRunStatus,
    modelUsage: row.modelUsage as Record<string, unknown> | undefined,
    thinking: row.thinking as AgentRun["thinking"],
    affectedFiles: row.affectedFiles as string[],
    validationResult: row.validationResult as ValidationResult | undefined,
    error: row.error as AgentRun["error"],
    startedAt: row.startedAt.toISOString(),
    completedAt: row.completedAt?.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toValues(run: AgentRun) {
  return {
    id: run.id,
    projectId: run.projectId,
    userId: run.userId,
    messageId: run.messageId,
    parentMessageId: run.parentMessageId,
    userPrompt: run.userPrompt,
    intent: run.intent,
    plan: run.plan,
    status: run.status,
    modelUsage: run.modelUsage,
    thinking: run.thinking,
    affectedFiles: run.affectedFiles,
    validationResult: run.validationResult,
    error: run.error,
    startedAt: new Date(run.startedAt),
    completedAt: run.completedAt ? new Date(run.completedAt) : null,
    createdAt: new Date(run.createdAt),
    updatedAt: new Date(run.updatedAt),
  };
}

export function sortRunsForProjectHistory(runs: AgentRun[]): AgentRun[] {
  return [...runs].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
}

export type ListProjectRunsOptions = {
  limit?: number;
};

export class PgAgentRunRepository {
  constructor(private readonly db: AgentRunDatabase) {}

  async save(run: AgentRun): Promise<AgentRun> {
    const values = toValues(run);
    const [row] = await this.db
      .insert(agentRuns)
      .values(values)
      .onConflictDoUpdate({ target: agentRuns.id, set: { ...values, id: undefined, createdAt: undefined } })
      .returning();
    return toRun(row);
  }

  async get(id: string, userId?: string): Promise<AgentRun | undefined> {
    const filter = userId
      ? and(eq(agentRuns.id, id), eq(agentRuns.userId, userId))
      : eq(agentRuns.id, id);
    const [row] = await this.db.select().from(agentRuns).where(filter);
    return row ? toRun(row) : undefined;
  }

  async listByProject(projectId: string, userId?: string, options: ListProjectRunsOptions = {}): Promise<AgentRun[]> {
    const filter = userId
      ? and(eq(agentRuns.projectId, projectId), eq(agentRuns.userId, userId))
      : eq(agentRuns.projectId, projectId);
    const query = this.db.select().from(agentRuns).where(filter).orderBy(desc(agentRuns.createdAt));
    const rows = options.limit ? await query.limit(Math.min(Math.max(options.limit, 1), 100)) : await query;
    return rows.map(toRun);
  }
}
