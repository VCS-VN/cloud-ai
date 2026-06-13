import { createServerFn } from "@tanstack/react-start";
import { requireServerUser } from "./auth";

function validateProjectInput(data: { projectId?: string }) {
  const projectId = data?.projectId?.trim();
  if (!projectId) throw new Error("Project id is required.");
  return { projectId };
}
async function loadProjectServices() {
  return (await import('../services/project-services')).getProjectServices();
}


export const getDevRuntimeState = createServerFn({ method: "GET" })
  .inputValidator(validateProjectInput)
  .handler(async ({ data }) => {
    const user = await requireServerUser();
    const { projectService } = await loadProjectServices();
    return projectService.getDevRuntimeState(data.projectId, user.id);
  });

export const startPreview = createServerFn({ method: "POST" })
  .inputValidator(validateProjectInput)
  .handler(async ({ data }) => {
    const user = await requireServerUser();
    const { projectService } = await loadProjectServices();
    return projectService.startPreview(data.projectId, user.id);
  });

export const stopPreview = createServerFn({ method: "POST" })
  .inputValidator(validateProjectInput)
  .handler(async ({ data }) => {
    const user = await requireServerUser();
    const { projectService } = await loadProjectServices();
    return projectService.stopPreview(data.projectId, user.id);
  });
