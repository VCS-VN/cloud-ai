import type { AgentRun } from "@/features/projects/legacy/project-state.schema";
import { getProjectServices } from "@/server/services/project-services";
import type { Project } from "@/shared/project-types";

function isNonTerminalRun(run: AgentRun): boolean {
  return run.status === "streaming" || run.status === "awaiting_input" || run.status === "interrupted";
}

export function shouldClearProjectProcessingOnCancel(
  project: Pick<Project, "activeRunId" | "processingStatus"> | undefined,
  runId: string,
): boolean {
  return (
    project?.activeRunId === runId ||
    (project?.processingStatus === "processing" && !project.activeRunId)
  );
}

export async function stopPersistedRunIfActive(
  projectId: string,
  runId: string,
  userId: string,
): Promise<boolean> {
  const services = await getProjectServices();
  const run = await services.chatHistoryService.runStore.load(runId, userId).catch(() => undefined);
  if (!run || run.projectId !== projectId) return false;

  let changed = false;
  if (isNonTerminalRun(run)) {
    await services.chatHistoryService.runStore.stop(run).catch(() => undefined);
    changed = true;
  }

  const project = await services.projectService["projectRepository"]
    .getProject(projectId, userId)
    .catch(() => undefined);
  if (shouldClearProjectProcessingOnCancel(project, runId)) {
    await services.projectService["projectRepository"]
      .updateProjectProcessingState(projectId, "idle", userId)
      .catch(() => undefined);
    changed = true;
  }
  return changed;
}
