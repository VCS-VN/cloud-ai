import type { ListProjectRunsOptions, PgAgentRunRepository } from "@/server/repositories/agent-run-repository";
import type { AgentRun, AgentRunStatus, ProjectMessageRunState, ProjectToolExecutionLog } from "./project-state.schema";

export type CreateAgentRunInput = {
  id?: string;
  projectId: string;
  userId?: string;
  parentMessageId?: string;
  retryOfRunId?: string;
  userPrompt: string;
  reasoningEffort?: AgentRun["reasoningEffort"];
  model?: string;
  planMode?: boolean;
  status?: AgentRunStatus;
};

export class ProjectRunStore {
  constructor(private readonly repository: PgAgentRunRepository) {}

  async create(input: CreateAgentRunInput): Promise<AgentRun> {
    const now = new Date().toISOString();
    return this.repository.save({
      id: input.id ?? crypto.randomUUID(),
      projectId: input.projectId,
      userId: input.userId,
      parentMessageId: input.parentMessageId,
      retryOfRunId: input.retryOfRunId,
      userPrompt: input.userPrompt,
      reasoningEffort: input.reasoningEffort,
      model: input.model,
      planMode: input.planMode ?? false,
      status: input.status ?? "streaming",
      affectedFiles: [],
      startedAt: now,
      createdAt: now,
      updatedAt: now,
    });
  }

  async load(runId: string, userId?: string): Promise<AgentRun> {
    const run = await this.repository.get(runId, userId);
    if (!run) throw new Error("Agent run not found.");
    return run;
  }

  async getActiveRun(projectId: string, userId?: string): Promise<AgentRun | undefined> {
    return this.repository.getActiveRun(projectId, userId);
  }

  async listByRetryChain(runId: string, userId?: string): Promise<AgentRun[]> {
    return this.repository.listByRetryChain(runId, userId);
  }

  async update(run: AgentRun, updates: Partial<AgentRun>): Promise<AgentRun> {
    return this.repository.save({
      ...run,
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  }

  async saveThinking(run: AgentRun, thinking: NonNullable<AgentRun["thinking"]>): Promise<AgentRun> {
    return this.update(run, { thinking });
  }

  async savePatchMetadata(run: AgentRun, changedFiles: string[]): Promise<AgentRun> {
    return this.update(run, { affectedFiles: Array.from(new Set([...run.affectedFiles, ...changedFiles])) });
  }

  async saveSnapshotMetadata(run: AgentRun, snapshotId: string): Promise<AgentRun> {
    return this.update(run, { modelUsage: { ...run.modelUsage, snapshotId } });
  }

  async waitForClarification(run: AgentRun, updates: Partial<AgentRun> = {}): Promise<AgentRun> {
    return this.repository.save({
      ...run,
      ...updates,
      thinking: updates.thinking ?? run.thinking,
      status: "awaiting_input",
      completedAt: undefined,
      updatedAt: new Date().toISOString(),
    });
  }

  async complete(run: AgentRun, updates: Partial<AgentRun> = {}): Promise<AgentRun> {
    const now = new Date().toISOString();
    return this.repository.save({
      ...run,
      ...updates,
      affectedFiles: updates.affectedFiles ?? run.affectedFiles,
      validationResult: updates.validationResult ?? run.validationResult,
      thinking: updates.thinking ?? run.thinking,
      status: "completed",
      completedAt: now,
      updatedAt: now,
    });
  }

  async saveValidationStatus(run: AgentRun, validationResult: NonNullable<AgentRun["validationResult"]>): Promise<AgentRun> {
    return this.update(run, { validationResult });
  }

  async waitForHumanReview(run: AgentRun, input: { reason: string; affectedFiles?: string[] }): Promise<AgentRun> {
    const now = new Date().toISOString();
    return this.repository.save({
      ...run,
      affectedFiles: input.affectedFiles ?? run.affectedFiles,
      status: "completed",
      completedAt: now,
      error: {
        code: "HUMAN_REVIEW_REQUIRED",
        message: input.reason,
        recoverable: true,
      },
      updatedAt: now,
    });
  }

  async saveMessageRunState(run: AgentRun, state: ProjectMessageRunState): Promise<AgentRun> {
    return this.update(run, { codeToolRunState: state });
  }

  async saveToolExecutionLog(log: ProjectToolExecutionLog): Promise<ProjectToolExecutionLog> {
    return this.repository.saveToolExecutionLog(log);
  }

  async listByProject(projectId: string, userId?: string, options: ListProjectRunsOptions = {}) {
    return this.repository.listByProject(projectId, userId, options);
  }

  async stop(run: AgentRun, updates: Partial<AgentRun> = {}): Promise<AgentRun> {
    const now = new Date().toISOString();
    return this.repository.save({
      ...run,
      ...updates,
      status: "stopped",
      completedAt: now,
      updatedAt: now,
    });
  }

  async fail(run: AgentRun, error: NonNullable<AgentRun["error"]>, updates: Partial<AgentRun> = {}): Promise<AgentRun> {
    const now = new Date().toISOString();
    return this.repository.save({
      ...run,
      ...updates,
      affectedFiles: updates.affectedFiles ?? run.affectedFiles,
      validationResult: updates.validationResult ?? run.validationResult,
      thinking: updates.thinking ?? run.thinking,
      status: "failed",
      error,
      completedAt: now,
      updatedAt: now,
    });
  }
}
