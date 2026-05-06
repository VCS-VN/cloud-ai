import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { X } from "lucide-react";
import {
  getSafeAuthMessage,
  mapFirebaseClientError,
} from "@/auth/auth-errors";
import { signInWithGoogleAndGetIdToken } from "@/auth/firebase-client";
import type { LoginErrorCode } from "@/auth/types";
import { loginWithFirebaseToken } from "@/server/functions/auth";
import { GoogleLoginButton } from "./GoogleLoginButton";

type LoginModalProps = {
  open: boolean;
  onClose: () => void;
};

export function LoginModal({ open, onClose }: LoginModalProps) {
  const navigate = useNavigate();
  const login = useServerFn(loginWithFirebaseToken);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  if (!open) return null;

  async function handleLogin() {
    if (loading) return;
    setLoading(true);
    setError(undefined);

    try {
      const { idToken } = await signInWithGoogleAndGetIdToken();
      const result = await login({ data: { idToken } });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      onClose();
      await navigate({ to: result.redirectTo as never });
    } catch (loginError) {
      const code: LoginErrorCode = mapFirebaseClientError(loginError);
      if (code === "popup-cancelled") return;
      setError(getSafeAuthMessage(code));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_srgb,var(--color-overlay-scrim)_48%,transparent)] p-md transition-opacity duration-200 ease-out"
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-title"
    >
      <div className="w-full max-w-[420px] rounded-lg border border-[var(--app-border)] bg-[var(--app-panel)] p-lg text-[var(--app-text)] shadow-none transition-all duration-200 ease-out">
        <div className="flex items-start justify-between gap-md">
          <div>
            <p className="m-0 text-[12px] font-[620] uppercase tracking-[0.14em] text-[var(--app-muted)]">
              Cloud AI
            </p>
            <h2
              id="login-title"
              className="m-0 mt-xs text-[28px] font-[680] leading-tight tracking-[-0.04em]"
            >
              Sign in to manage your projects
            </h2>
          </div>
          <button
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--app-border)] text-[var(--app-muted)] outline-none transition-colors duration-200 hover:text-[var(--app-text)] focus-visible:ring-2 focus-visible:ring-[var(--app-accent)]"
            type="button"
            onClick={onClose}
            aria-label="Close sign-in"
            disabled={loading}
          >
            <X aria-hidden="true" size={16} />
          </button>
        </div>

        <p className="mb-lg mt-sm text-[14px] leading-6 text-[var(--app-muted)]">
          Sign in with Google to continue to your projects.
        </p>

        <GoogleLoginButton
          loading={loading}
          disabled={loading}
          onClick={handleLogin}
        />

        {error ? (
          <p
            className="mt-sm rounded-md border border-[var(--app-border-strong)] bg-[var(--app-danger-bg)] p-sm text-[13px] leading-5 text-[var(--app-danger-text)]"
            role="alert"
          >
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
