import { createServerFn } from "@tanstack/react-start";
import { requireServerUser } from "./auth";
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
