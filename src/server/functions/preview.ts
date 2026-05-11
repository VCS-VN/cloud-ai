import { createServerFn } from "@tanstack/react-start";
import { requireServerUser } from "./auth";
import { getProjectServices } from "../services/project-services";

function validateProjectInput(data: { projectId?: string }) {
  const projectId = data?.projectId?.trim();
  if (!projectId) throw new Error("Project id is required.");
  return { projectId };
}

export const getDevRuntimeState = createServerFn({ method: "GET" })
  .inputValidator(validateProjectInput)
  .handler(async ({ data }) => {
    const user = await requireServerUser();
    const { projectService } = await getProjectServices();
    return projectService.getDevRuntimeState(data.projectId, user.id);
  });

export const startPreview = createServerFn({ method: "POST" })
  .inputValidator(validateProjectInput)
  .handler(async ({ data }) => {
    const user = await requireServerUser();
    const { projectService } = await getProjectServices();
    return projectService.startPreview(data.projectId, user.id);
  });
