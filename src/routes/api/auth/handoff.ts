import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute(
  // @ts-ignore API routes are runtime-only and omitted from routeTree.gen.ts.
  "/api/auth/handoff",
)({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { getAuthService } = await import("@/auth/auth-service");
        const { createSessionSetCookieHeaderForUserId } = await import(
          "@/auth/session-service.server"
        );
        const { getCurrentRequestOrigin } = await import(
          "@/auth/request-origin.server"
        );

        const origin = getCurrentRequestOrigin();
        const url = new URL(request.url);
        const code = url.searchParams.get("code") ?? "";

        const result = await getAuthService().signInWithHandoffCode(code);

        const location = result.ok
          ? `${origin}${result.redirectTo}`
          : `${origin}/?error=${encodeURIComponent(result.code)}`;

        const headers = new Headers({ Location: location });
        if (result.ok) {
          const sessionCookie = await createSessionSetCookieHeaderForUserId(
            result.user.id,
          );
          headers.append("Set-Cookie", sessionCookie);
        }

        return new Response(null, { status: 302, headers });
      },
    },
  },
});
