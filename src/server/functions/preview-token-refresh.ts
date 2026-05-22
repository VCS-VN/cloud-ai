import { createServerFn } from "@tanstack/react-start";
import { setCookie } from "@tanstack/react-start/server";
import { PREVIEW_TOKEN_COOKIE_NAME } from "@/features/ai-agent/runtime/preview-token-service.server";
import { requireServerUser } from "./auth";
import { getProjectServices } from "../services/project-services";

function validateInput(data: { projectId?: string }) {
  const projectId = data?.projectId?.trim();
  if (!projectId) throw new Error("Project id is required.");
  return { projectId };
}

export const refreshPreviewToken = createServerFn({ method: "POST" })
  .inputValidator(validateInput)
  .handler(async ({ data }) => {
    const user = await requireServerUser();
    const { previewTokenService } = await getProjectServices();
    const result = await previewTokenService.issueToken({ projectId: data.projectId, userId: user.id });
    setCookie(PREVIEW_TOKEN_COOKIE_NAME, result.token, previewTokenService.getCookieOptions());
    return { ok: true, expiresAt: result.expiresAt };
  });
