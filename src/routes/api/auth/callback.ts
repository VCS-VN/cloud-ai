import { createFileRoute } from "@tanstack/react-router";
import { clearOAuthTempSession, createOAuthTempClearCookieHeader, readOAuthTempSession } from "@/auth/oauth-temp-session.server";
import { createSessionSetCookieHeaderForUserId } from "@/auth/session-service.server";
import type { LoginResult, OAuthCallbackQuery, OAuthLoginInput } from "@/auth/types";

export const Route = createFileRoute(
  // @ts-ignore API routes are runtime-only and omitted from routeTree.gen.ts.
  "/api/auth/callback",
)({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { getAuthService } = await import("@/auth/auth-service");
        const { handleOAuthCallback } = await import("@/auth/oauth-callback-handler");
        const { getCurrentRequestOrigin } = await import("@/auth/request-origin.server");
        const url = new URL(request.url);
        const query: OAuthCallbackQuery = {
          code: url.searchParams.get("code") ?? undefined,
          state: url.searchParams.get("state") ?? undefined,
          error: url.searchParams.get("error") ?? undefined,
          errorDescription: url.searchParams.get("error_description") ?? undefined,
        };
        const origin = getCurrentRequestOrigin();
        let sessionCookieHeader: string | null = null;
        const signInWithOAuthCode = async (input: OAuthLoginInput): Promise<LoginResult> => {
          const result = await getAuthService().signInWithOAuthCode(input);
          if (result.ok) sessionCookieHeader = await createSessionSetCookieHeaderForUserId(result.user.id);
          return result;
        };
        const result = await handleOAuthCallback(query, {
          clearTempSession: clearOAuthTempSession,
          readTempSession: readOAuthTempSession,
          signInWithOAuthCode,
          getCloudAiOrigin: () => origin,
          getOauthRedirectUri: () => `${origin}/api/auth/callback`,
        });
        const headers = new Headers({ Location: result.redirectHref });
        if (sessionCookieHeader) headers.append("Set-Cookie", sessionCookieHeader);
        headers.append("Set-Cookie", createOAuthTempClearCookieHeader());

        return new Response(null, { status: 302, headers });
      },
    },
  },
});
