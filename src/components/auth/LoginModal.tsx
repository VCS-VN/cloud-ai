import { useState } from "react";
import { X } from "lucide-react";
import { GoogleLoginButton } from "./GoogleLoginButton";

type LoginModalProps = {
  open: boolean;
  onClose: () => void;
};

export function LoginModal({ open, onClose }: LoginModalProps) {
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  function handleLogin() {
    if (loading) return;
    setLoading(true);
    window.location.href = "/auth/login";
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
          Continue with your Monmi account to access Cloud AI.
        </p>

        <GoogleLoginButton
          loading={loading}
          disabled={loading}
          onClick={handleLogin}
        />
      </div>
    </div>
  );
}
