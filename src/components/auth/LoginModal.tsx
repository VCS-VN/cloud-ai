import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { GoogleLoginButton } from "./GoogleLoginButton";

type LoginModalProps = {
  open: boolean;
  onClose: () => void;
};

export function LoginModal({ open, onClose }: LoginModalProps) {
  const [loading, setLoading] = useState(false);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !loading) onClose();
    }

    closeRef.current?.focus();
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, loading, onClose]);

  if (!open) return null;

  function handleLogin() {
    if (loading) return;
    setLoading(true);
    window.location.href = "/auth/login";
  }

  return (
    <div
      className="motion-overlay-in fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_srgb,var(--color-overlay-scrim)_48%,transparent)] p-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-title"
      onClick={() => {
        if (!loading) onClose();
      }}
    >
      <div
        className="motion-dialog-in w-full max-w-[420px] rounded-lg border border-[var(--app-border)] bg-[var(--app-panel)] p-lg text-[var(--app-text)] shadow-[var(--shadow-editorial)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-md">
          <div>
            <p className="m-0 font-mono text-caption uppercase tracking-[0.6px] text-[var(--app-muted)]">
              Cloud AI
            </p>
            <h2
              id="login-title"
              className="m-0 mt-xs text-headline font-[540] leading-[1.2] tracking-[-0.26px]"
            >
              Sign in to manage your projects
            </h2>
          </div>
          <button
            ref={closeRef}
            className="motion-press inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--app-border)] text-[var(--app-muted)] outline-none hover:border-[var(--app-border-strong)] hover:text-[var(--app-text)] focus-visible:ring-2 focus-visible:ring-[var(--app-accent)]"
            type="button"
            onClick={onClose}
            aria-label="Close sign-in"
            disabled={loading}
          >
            <X aria-hidden="true" size={16} />
          </button>
        </div>

        <p className="mb-lg mt-sm text-body-sm leading-[1.5] text-[var(--app-muted)]">
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
