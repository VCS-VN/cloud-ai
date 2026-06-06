import { createServerFn } from "@tanstack/react-start";
import { setCookie } from "@tanstack/react-start/server";
import { PREVIEW_TOKEN_COOKIE_NAME } from "@/features/runtime/legacy/preview-token-service.server";
import { requireServerUser } from "./auth";

function validateInput(data: { projectId?: string }) {
  const projectId = data?.projectId?.trim();
  if (!projectId) throw new Error("Project id is required.");
  return { projectId };
}
async function loadProjectServices() {
  return (await import('../services/project-services')).getProjectServices();
}


export const refreshPreviewToken = createServerFn({ method: "POST" })
  .inputValidator(validateInput)
  .handler(async ({ data }) => {
    const user = await requireServerUser();
    const { previewTokenService } = await loadProjectServices();
    const result = await previewTokenService.issueToken({ projectId: data.projectId, userId: user.id });
    setCookie(PREVIEW_TOKEN_COOKIE_NAME, result.token, previewTokenService.getCookieOptions());
    return { ok: true, expiresAt: result.expiresAt };
  });
