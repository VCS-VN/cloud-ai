import { createServerFn } from "@tanstack/react-start";
import { requireServerUser } from "./auth";
import type { ComposerReasoningEffort } from "@/shared/project-types";
async function loadProjectServices() {
  return (await import('../services/project-services')).getProjectServices();
}


export const listProjectMessages = createServerFn({ method: "GET" })
  .inputValidator(
    (data: {
      projectId: string;
      beforeCreatedAt?: string;
      beforeId?: string;
      limit?: number;
    }) => data,
  )
  .handler(async ({ data }) => {
    const user = await requireServerUser();
    const { messageService } = await loadProjectServices();
    return messageService.getProjectMessages(data.projectId, user.id, {
      beforeCreatedAt: data.beforeCreatedAt,
      beforeId: data.beforeId,
      limit: data.limit,
    });
  });

export const sendProjectMessage = createServerFn({ method: "POST" })
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

    return messageService.sendProjectMessage(
      data.projectId,
      data.content,
      {
        reasoningEffort: data.reasoningEffort,
        planMode: data.planMode,
      },
      user.id,
    );
  });

export const stopProjectGeneration = createServerFn({ method: "POST" })
  .inputValidator((data: { projectId: string; agentMessageId: string }) => data)
  .handler(async ({ data }) => {
    const user = await requireServerUser();
    const { messageService } = await loadProjectServices();
    return messageService.stopProjectGeneration(
      data.projectId,
      data.agentMessageId,
      user.id,
    );
  });

export const retryProjectMessage = createServerFn({ method: "POST" })
  .inputValidator((data: { projectId: string; messageId: string }) => data)
  .handler(async ({ data }) => {
    const user = await requireServerUser();
    const { messageService } = await loadProjectServices();
    return messageService.retryProjectMessage(
      data.projectId,
      data.messageId,
      user.id,
    );
  });
