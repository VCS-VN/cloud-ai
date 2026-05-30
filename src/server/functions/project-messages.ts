import { createServerFn } from "@tanstack/react-start";
import { requireServerUser } from "./auth";
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
