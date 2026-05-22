import { createFileRoute } from "@tanstack/react-router";
import { PREVIEW_TOKEN_COOKIE_NAME } from "@/features/ai-agent/runtime/preview-token-service.server";
import { requireServerUser } from "@/server/functions/auth";

export const Route = createFileRoute(
  // @ts-ignore API routes are runtime-only and omitted from routeTree.gen.ts.
  "/api/projects/$projectId/preview-token/refresh",
)({
  server: {
    handlers: {
      POST: async ({ params }) => {
        const user = await requireServerUser();
        const { getProjectServices } = await import("@/server/services/project-services");
        const { previewTokenService } = await getProjectServices();
        const result = await previewTokenService.issueToken({ projectId: params.projectId, userId: user.id });
        const headers = new Headers({ "content-type": "application/json" });
        headers.append(
          "Set-Cookie",
          serializeCookie(PREVIEW_TOKEN_COOKIE_NAME, result.token, previewTokenService.getCookieOptions()),
        );
        return new Response(JSON.stringify({ ok: true, expiresAt: result.expiresAt }), { status: 200, headers });
      },
    },
  },
});

function serializeCookie(name: string, value: string, options: ReturnType<import("@/features/ai-agent/runtime/preview-token-service.server").PreviewTokenService["getCookieOptions"]>) {
  const parts = [`${name}=${value}`, `Path=${options.path}`, `Max-Age=${options.maxAge}`, `SameSite=${options.sameSite}`];
  if (options.domain) parts.push(`Domain=${options.domain}`);
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.secure) parts.push("Secure");
  return parts.join("; ");
}
