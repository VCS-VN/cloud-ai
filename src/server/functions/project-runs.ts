import { createServerFn } from "@tanstack/react-start";
import { requireServerUser } from "./auth";
import { getProjectServices } from "../services/project-services";

export const listProjectRuns = createServerFn({ method: "GET" })
  .inputValidator((data: { projectId: string; limit?: number }) => data)
  .handler(async ({ data }) => {
    const user = await requireServerUser();
    const { projectRunService } = await getProjectServices();
    return projectRunService.listProjectRuns(data.projectId, user.id, { limit: data.limit });
  });
