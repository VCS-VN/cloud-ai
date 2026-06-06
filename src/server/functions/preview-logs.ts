import { createServerFn } from "@tanstack/react-start";
import { tailPm2PreviewLog } from "@/features/runtime/legacy/runtime-logs.server";
import { requireServerUser } from "./auth";

function validateInput(data: { projectId?: string; tail?: number }) {
  const projectId = data?.projectId?.trim();
  if (!projectId) throw new Error("Project id is required.");
  const tail = typeof data?.tail === "number" ? data.tail : 200;
  return { projectId, tail };
}
async function loadProjectServices() {
  return (await import('../services/project-services')).getProjectServices();
}


export const getPreviewLogs = createServerFn({ method: "GET" })
  .inputValidator(validateInput)
  .handler(async ({ data }) => {
    const user = await requireServerUser();
    const { projectService } = await loadProjectServices();
    await projectService.getDevRuntimeState(data.projectId, user.id);
    return tailPm2PreviewLog(data.projectId, data.tail);
  });
