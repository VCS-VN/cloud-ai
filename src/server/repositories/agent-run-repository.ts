import { and, asc, desc, eq, or } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { agentRuns, projectToolExecutionLogs } from "@/db/schema";
import type * as schema from "@/db/schema";
import type {
  AgentRun,
  AgentRunClarificationSnapshot,
  AgentRunFailureCode,
  AgentRunKind,
  AgentRunPlanPhase,
  AgentRunProgressTimelineEvent,
  AgentRunStatus,
  BuilderIntent,
  ChangePlan,
  ProjectToolExecutionLog,
  ValidationResult,
} from "@/features/projects/legacy/project-state.schema";

type AgentRunDatabase = PostgresJsDatabase<typeof schema>;
type AgentRunRow = typeof agentRuns.$inferSelect;

const MAX_PROGRESS_TIMELINE_EVENTS = 200;

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
    kind: (row.kind as AgentRunKind | null) ?? undefined,
    intent: row.intent as BuilderIntent | undefined,
    plan: row.plan as ChangePlan | undefined,
    status: row.status as AgentRunStatus,
    failureCode: (row.failureCode as AgentRunFailureCode | null) ?? undefined,
    modelUsage: row.modelUsage as Record<string, unknown> | undefined,
    thinking: row.thinking as AgentRun["thinking"],
    affectedFiles: row.affectedFiles as string[],
    validationResult: row.validationResult as ValidationResult | undefined,
    codeToolRunState: row.codeToolRunState as AgentRun["codeToolRunState"],
    progressTimeline: (row.progressTimeline as AgentRunProgressTimelineEvent[] | null) ?? [],
    planPhase: (row.planPhase as AgentRunPlanPhase | null) ?? null,
    clarificationSnapshot:
      (row.clarificationSnapshot as AgentRunClarificationSnapshot | null) ?? null,
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
    kind: run.kind ?? null,
    intent: run.intent,
    plan: run.plan,
    status: run.status,
    failureCode: run.failureCode ?? null,
    modelUsage: run.modelUsage,
    thinking: run.thinking,
    affectedFiles: run.affectedFiles,
    validationResult: run.validationResult,
    codeToolRunState: run.codeToolRunState,
    progressTimeline: run.progressTimeline ?? [],
    planPhase: run.planPhase ?? null,
    clarificationSnapshot: run.clarificationSnapshot ?? null,
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

export type ReconcileOrphanRunsResult = {
  interruptedRunIds: string[];
  recoveredAwaitingClarificationRunIds: string[];
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
    // Include awaiting_input as an active run status (023: interactive agent questions)
    const isActive = or(
      eq(agentRuns.status, "streaming"),
      eq(agentRuns.status, "awaiting_input"),
    );
    const filter = userId
      ? and(eq(agentRuns.projectId, projectId), eq(agentRuns.userId, userId), isActive)
      : and(eq(agentRuns.projectId, projectId), isActive);
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

  async appendProgressTimelineEvent(
    runId: string,
    event: AgentRunProgressTimelineEvent,
  ): Promise<void> {
    const [row] = await this.db.select().from(agentRuns).where(eq(agentRuns.id, runId));
    if (!row) return;
    const existing = (row.progressTimeline as AgentRunProgressTimelineEvent[] | null) ?? [];
    // todo_snapshot carries the full flattened todo list on every update, so
    // only the latest snapshot matters for archived replay. Drop prior
    // todo_snapshot entries before appending the new one to keep the timeline
    // bounded and avoid replaying stale intermediate lists.
    const filtered =
      event.kind === "todo_snapshot"
        ? existing.filter((item) => item.kind !== "todo_snapshot")
        : existing;
    const next = [...filtered, event];
    const trimmed =
      next.length > MAX_PROGRESS_TIMELINE_EVENTS
        ? next.slice(next.length - MAX_PROGRESS_TIMELINE_EVENTS)
        : next;
    await this.db
      .update(agentRuns)
      .set({ progressTimeline: trimmed, updatedAt: new Date() })
      .where(eq(agentRuns.id, runId));
  }

  async setPlanPhase(runId: string, planPhase: AgentRunPlanPhase | null): Promise<void> {
    await this.db
      .update(agentRuns)
      .set({ planPhase, updatedAt: new Date() })
      .where(eq(agentRuns.id, runId));
  }

  async setClarificationSnapshot(
    runId: string,
    snapshot: AgentRunClarificationSnapshot | null,
  ): Promise<void> {
    await this.db
      .update(agentRuns)
      .set({ clarificationSnapshot: snapshot, updatedAt: new Date() })
      .where(eq(agentRuns.id, runId));
  }

  async setStatus(
    runId: string,
    status: AgentRunStatus,
    failureCode?: AgentRunFailureCode,
  ): Promise<void> {
    const completedAt =
      status === "completed" || status === "failed" || status === "stopped" || status === "interrupted"
        ? new Date()
        : null;
    await this.db
      .update(agentRuns)
      .set({
        status,
        failureCode: failureCode ?? null,
        completedAt: completedAt ?? undefined,
        updatedAt: new Date(),
      })
      .where(eq(agentRuns.id, runId));
  }

  async setKind(runId: string, kind: AgentRunKind): Promise<void> {
    await this.db
      .update(agentRuns)
      .set({ kind, updatedAt: new Date() })
      .where(eq(agentRuns.id, runId));
  }

  async reconcileOrphanRuns(input: {
    isLiveHandle: (runId: string) => boolean;
    now?: Date;
  }): Promise<ReconcileOrphanRunsResult> {
    const now = input.now ?? new Date();
    const orphanFilter = or(
      eq(agentRuns.status, "streaming"),
      eq(agentRuns.status, "awaiting_input"),
    );
    const rows = await this.db.select().from(agentRuns).where(orphanFilter);
    const interrupted: string[] = [];
    const recovered: string[] = [];
    for (const row of rows) {
      if (input.isLiveHandle(row.id)) continue;
      if (row.status === "streaming") {
        await this.db
          .update(agentRuns)
          .set({
            status: "interrupted",
            failureCode: "interrupted_by_restart",
            completedAt: now,
            updatedAt: now,
          })
          .where(eq(agentRuns.id, row.id));
        interrupted.push(row.id);
      } else if (row.status === "awaiting_input") {
        const snapshot = row.clarificationSnapshot as AgentRunClarificationSnapshot | null;
        if (snapshot) {
          recovered.push(row.id);
        } else {
          await this.db
            .update(agentRuns)
            .set({
              status: "interrupted",
              failureCode: "interrupted_by_restart",
              completedAt: now,
              updatedAt: now,
            })
            .where(eq(agentRuns.id, row.id));
          interrupted.push(row.id);
        }
      }
    }
    return {
      interruptedRunIds: interrupted,
      recoveredAwaitingClarificationRunIds: recovered,
    };
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

export const __testing = { MAX_PROGRESS_TIMELINE_EVENTS };
