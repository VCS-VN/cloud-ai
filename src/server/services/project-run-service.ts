import type { ListProjectRunsOptions } from "@/server/repositories/agent-run-repository";
import type { ProjectRepository } from "@/shared/project-types";
import type { ProjectRunStore } from "@/features/ai-agent/project/project-run-store.server";

export class ProjectRunService {
  constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly runStore: ProjectRunStore,
  ) {}

  async listProjectRuns(projectId: string, userId?: string, options: ListProjectRunsOptions = {}) {
    const project = await this.projectRepository.getProject(projectId, userId);
    if (!project) throw new Error("Project not found.");
    const runs = await this.runStore.listByProject(projectId, userId, options);
    return runs.map((run) => ({
      id: run.id,
      projectId: run.projectId,
      userId: run.userId,
      messageId: run.messageId,
      userPrompt: run.userPrompt,
      intent: run.intent,
      plan: run.plan,
      status: run.status,
      affectedFiles: run.affectedFiles,
      validationResult: run.validationResult,
      error: run.error,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      createdAt: run.createdAt,
      updatedAt: run.updatedAt,
    }));
  }
}
