import { createServerFn } from "@tanstack/react-start";
import { requireServerUser } from "./auth";
import type { ComposerReasoningEffort } from "@/shared/project-types";
async function loadProjectServices() {
  return (await import('../services/project-services')).getProjectServices();
}


export const listProjectRuns = createServerFn({ method: "GET" })
  .inputValidator((data: { projectId: string; limit?: number }) => data)
  .handler(async ({ data }) => {
    const user = await requireServerUser();
    const { projectRunService } = await loadProjectServices();
    return projectRunService.listProjectRuns(data.projectId, user.id, { limit: data.limit });
  });

export const createProjectRun = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      projectId: string;
      content: string;
      reasoningEffort?: ComposerReasoningEffort;
      planMode?: boolean;
    }) => data,
  )
  .handler(async ({ data }) => {
    const user = await requireServerUser();
    const { messageService } = await loadProjectServices();
    return messageService.createRun(
      data.projectId,
      data.content,
      { reasoningEffort: data.reasoningEffort, planMode: data.planMode },
      user.id,
    );
  });

export const stopProjectRun = createServerFn({ method: "POST" })
  .inputValidator((data: { projectId: string; runId: string }) => data)
  .handler(async ({ data }) => {
    const user = await requireServerUser();
    const { messageService } = await loadProjectServices();
    return messageService.stopRun(data.projectId, data.runId, user.id);
  });

export const retryProjectRun = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      projectId: string;
      runId: string;
      reasoningEffort?: ComposerReasoningEffort;
      planMode?: boolean;
    }) => data,
  )
  .handler(async ({ data }) => {
    const user = await requireServerUser();
    const { messageService } = await loadProjectServices();
    return messageService.retryRun(
      data.projectId,
      data.runId,
      { reasoningEffort: data.reasoningEffort, planMode: data.planMode },
      user.id,
    );
  });

// T022: Select option from agent_question
export const selectRunOption = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      projectId: string;
      runId: string;
      optionId: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const user = await requireServerUser();
    const { messageService } = await loadProjectServices();
    return messageService.selectOption(
      data.projectId,
      data.runId,
      data.optionId,
      user.id,
    );
  });
