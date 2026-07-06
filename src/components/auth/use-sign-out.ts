import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { logout } from "@/server/functions/auth";

/**
 * Single source of truth for the sign-out action. Both the dashboard sidebar
 * button and the UserMenu consume this so loading state, the server call, and
 * the post-logout redirect can never drift apart.
 */
export function useSignOut(options?: { beforeNavigate?: () => void }) {
  const navigate = useNavigate();
  const logoutFn = useServerFn(logout);
  const [loading, setLoading] = useState(false);

  async function signOut() {
    if (loading) return;
    setLoading(true);
    try {
      const result = await logoutFn();
      options?.beforeNavigate?.();
      await navigate({ to: result.redirectTo as never });
    } finally {
      setLoading(false);
    }
  }

  return { signOut, loading };
}
