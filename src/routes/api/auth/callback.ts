import { createFileRoute } from "@tanstack/react-router";
import type { OAuthCallbackQuery } from "@/auth/types";

export const Route = createFileRoute(
  // @ts-ignore API routes are runtime-only and omitted from routeTree.gen.ts.
  "/api/auth/callback",
)({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { handleOAuthCallback } = await import("@/auth/oauth-callback.server");
        const { getCurrentRequestOrigin } = await import("@/auth/request-origin.server");
        const url = new URL(request.url);
        const query: OAuthCallbackQuery = {
          code: url.searchParams.get("code") ?? undefined,
          state: url.searchParams.get("state") ?? undefined,
          error: url.searchParams.get("error") ?? undefined,
          errorDescription: url.searchParams.get("error_description") ?? undefined,
        };
        const origin = getCurrentRequestOrigin();
        const result = await handleOAuthCallback(query, {
          origin,
          redirectUri: `${origin}/api/auth/callback`,
        });

        return Response.redirect(result.redirectHref, 302);
      },
    },
  },
});
