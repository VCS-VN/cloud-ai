import type { ListProjectRunsOptions, PgAgentRunRepository } from "@/server/repositories/agent-run-repository";
import type { AgentRun, AgentRunStatus } from "./project-state.schema";

export type CreateAgentRunInput = {
  projectId: string;
  userId?: string;
  messageId?: string;
  parentMessageId?: string;
  userPrompt: string;
  status?: AgentRunStatus;
};

export class ProjectRunStore {
  constructor(private readonly repository: PgAgentRunRepository) {}

  async create(input: CreateAgentRunInput): Promise<AgentRun> {
    const now = new Date().toISOString();
    return this.repository.save({
      id: crypto.randomUUID(),
      projectId: input.projectId,
      userId: input.userId,
      messageId: input.messageId,
      parentMessageId: input.parentMessageId,
      userPrompt: input.userPrompt,
      status: input.status ?? "running",
      affectedFiles: [],
      startedAt: now,
      createdAt: now,
      updatedAt: now,
    });
  }

  async update(run: AgentRun, updates: Partial<AgentRun>): Promise<AgentRun> {
    return this.repository.save({
      ...run,
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  }

  async waitForClarification(run: AgentRun, updates: Partial<AgentRun> = {}): Promise<AgentRun> {
    return this.repository.save({
      ...run,
      ...updates,
      status: "waiting_for_clarification",
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
      status: "completed",
      completedAt: now,
      updatedAt: now,
    });
  }

  async listByProject(projectId: string, userId?: string, options: ListProjectRunsOptions = {}) {
    return this.repository.listByProject(projectId, userId, options);
  }

  async fail(run: AgentRun, error: NonNullable<AgentRun["error"]>, updates: Partial<AgentRun> = {}): Promise<AgentRun> {
    const now = new Date().toISOString();
    return this.repository.save({
      ...run,
      ...updates,
      affectedFiles: updates.affectedFiles ?? run.affectedFiles,
      validationResult: updates.validationResult ?? run.validationResult,
      status: "failed",
      error,
      completedAt: now,
      updatedAt: now,
    });
  }
}
