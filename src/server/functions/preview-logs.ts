import { createServerFn } from "@tanstack/react-start";
import { tailPm2PreviewLog } from "@/features/ai-agent/runtime/runtime-logs.server";
import { requireServerUser } from "./auth";
import { getProjectServices } from "../services/project-services";

function validateInput(data: { projectId?: string; tail?: number }) {
  const projectId = data?.projectId?.trim();
  if (!projectId) throw new Error("Project id is required.");
  const tail = typeof data?.tail === "number" ? data.tail : 200;
  return { projectId, tail };
}

export const getPreviewLogs = createServerFn({ method: "GET" })
  .inputValidator(validateInput)
  .handler(async ({ data }) => {
    const user = await requireServerUser();
    const { projectService } = await getProjectServices();
    await projectService.getDevRuntimeState(data.projectId, user.id);
    return tailPm2PreviewLog(data.projectId, data.tail);
  });
