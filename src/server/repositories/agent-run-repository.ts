import { and, asc, desc, eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { agentRuns, projectToolExecutionLogs } from "@/db/schema";
import type * as schema from "@/db/schema";
import type { AgentRun, AgentRunStatus, BuilderIntent, ChangePlan, ProjectToolExecutionLog, ValidationResult } from "@/features/ai-agent/project/project-state.schema";

type AgentRunDatabase = PostgresJsDatabase<typeof schema>;
type AgentRunRow = typeof agentRuns.$inferSelect;

function toRun(row: AgentRunRow): AgentRun {
  return {
    id: row.id,
    projectId: row.projectId,
    userId: row.userId ?? undefined,
    parentMessageId: row.parentMessageId ?? undefined,
    retryOfRunId: row.retryOfRunId ?? undefined,
    userPrompt: row.userPrompt,
    reasoningEffort: (row.reasoningEffort as AgentRun["reasoningEffort"]) ?? undefined,
    planMode: row.planMode,
    intent: row.intent as BuilderIntent | undefined,
    plan: row.plan as ChangePlan | undefined,
    status: row.status as AgentRunStatus,
    modelUsage: row.modelUsage as Record<string, unknown> | undefined,
    thinking: row.thinking as AgentRun["thinking"],
    affectedFiles: row.affectedFiles as string[],
    validationResult: row.validationResult as ValidationResult | undefined,
    codeToolRunState: row.codeToolRunState as AgentRun["codeToolRunState"],
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
    parentMessageId: run.parentMessageId,
    retryOfRunId: run.retryOfRunId,
    userPrompt: run.userPrompt,
    reasoningEffort: run.reasoningEffort,
    planMode: run.planMode,
    intent: run.intent,
    plan: run.plan,
    status: run.status,
    modelUsage: run.modelUsage,
    thinking: run.thinking,
    affectedFiles: run.affectedFiles,
    validationResult: run.validationResult,
    codeToolRunState: run.codeToolRunState,
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

  async getActiveRun(projectId: string, userId?: string): Promise<AgentRun | undefined> {
    const filter = userId
      ? and(
          eq(agentRuns.projectId, projectId),
          eq(agentRuns.userId, userId),
          eq(agentRuns.status, "streaming"),
        )
      : and(eq(agentRuns.projectId, projectId), eq(agentRuns.status, "streaming"));
    const [row] = await this.db
      .select()
      .from(agentRuns)
      .where(filter)
      .orderBy(desc(agentRuns.createdAt))
      .limit(1);
    return row ? toRun(row) : undefined;
  }

  async listByRetryChain(runId: string, userId?: string): Promise<AgentRun[]> {
    const filter = userId
      ? and(eq(agentRuns.retryOfRunId, runId), eq(agentRuns.userId, userId))
      : eq(agentRuns.retryOfRunId, runId);
    const rows = await this.db
      .select()
      .from(agentRuns)
      .where(filter)
      .orderBy(asc(agentRuns.createdAt));
    return rows.map(toRun);
  }

  async saveToolExecutionLog(log: ProjectToolExecutionLog): Promise<ProjectToolExecutionLog> {
    const values = {
      id: log.id,
      projectId: log.projectId,
      messageId: log.messageId,
      toolName: log.toolName,
      category: log.category,
      status: log.status,
      safeArgsSummary: log.safeArgsSummary,
      safeResultSummary: log.safeResultSummary,
      errorCode: log.errorCode,
      recoverable: log.recoverable,
      startedAt: new Date(log.startedAt),
      completedAt: log.completedAt ? new Date(log.completedAt) : null,
      durationMs: log.durationMs,
    };
    const [row] = await this.db
      .insert(projectToolExecutionLogs)
      .values(values)
      .onConflictDoUpdate({ target: projectToolExecutionLogs.id, set: { ...values, id: undefined } })
      .returning();
    return {
      id: row.id,
      projectId: row.projectId,
      messageId: row.messageId,
      toolName: row.toolName,
      category: row.category as ProjectToolExecutionLog["category"],
      status: row.status as ProjectToolExecutionLog["status"],
      safeArgsSummary: row.safeArgsSummary,
      safeResultSummary: row.safeResultSummary ?? undefined,
      errorCode: row.errorCode ?? undefined,
      recoverable: row.recoverable ?? undefined,
      startedAt: row.startedAt.toISOString(),
      completedAt: row.completedAt?.toISOString(),
      durationMs: row.durationMs ?? undefined,
    };
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
