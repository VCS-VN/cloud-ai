import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { LogOut, Monitor, Moon, Settings, Sun, UserRound } from "lucide-react";
import type { AuthUserSummary } from "@/auth/types";
import { Button } from "@/components/ui/button";
import { logout } from "@/server/functions/auth";
import { useTheme, type AppTheme } from "@/theme";

type UserMenuProps = {
  user?: AuthUserSummary | null;
  onProfile?: () => void;
  compact?: boolean;
  placement?: "top" | "bottom";
  align?: "left" | "right";
};

const THEME_OPTIONS: Array<{
  value: AppTheme;
  label: string;
  icon: typeof Sun;
}> = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

export function UserMenu({
  user,
  onProfile,
  compact = false,
  placement = "bottom",
  align = "right",
}: UserMenuProps) {
  const navigate = useNavigate();
  const logoutFn = useServerFn(logout);
  const { theme, setTheme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;

    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  async function handleLogout() {
    if (loading) return;
    setLoading(true);
    try {
      const result = await logoutFn();
      setOpen(false);
      await navigate({ to: result.redirectTo });
    } finally {
      setLoading(false);
    }
  }

  function closeAndNavigate(to: string) {
    setOpen(false);
    void navigate({ to: to as never });
  }

  function handleProfile() {
    if (onProfile) {
      setOpen(false);
      onProfile();
      return;
    }
    closeAndNavigate("/settings/profile");
  }

  const panelPosition = `${placement === "top" ? "bottom-[calc(100%+8px)]" : "top-[calc(100%+8px)]"} ${align === "right" ? "right-0" : "left-0"}`;
  const userLabel = user?.displayName || user?.email || "Account";
  const initials = getInitials(userLabel);

  return (
    <div className="relative" ref={menuRef}>
      <Button
        variant="unstyled"
        type="button"
        onClick={() => setOpen((current) => !current)}
        disabled={loading}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={open ? "Close account menu" : "Open account menu"}
        title={user?.email ?? userLabel}
        className={
          compact
            ? "inline-flex h-8 w-8 items-center justify-center rounded-full bg-ink text-paper text-[11px] font-semibold ring-1 ring-hairline transition hover:ring-ink/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 disabled:cursor-not-allowed disabled:opacity-60"
            : "inline-flex h-9 items-center gap-2 rounded-full bg-ink text-paper px-2 pr-3 text-[12px] font-semibold ring-1 ring-hairline transition hover:ring-ink/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 disabled:cursor-not-allowed disabled:opacity-60"
        }
      >
        {user?.photoUrl ? (
          <img
            className="h-full w-full rounded-full object-cover"
            src={user.photoUrl}
            alt=""
            referrerPolicy="no-referrer"
          />
        ) : (
          <span aria-hidden="true">{initials}</span>
        )}
        {!compact ? (
          <span className="max-w-[140px] truncate">{userLabel}</span>
        ) : null}
      </Button>

      {open ? (
        <div
          role="menu"
          aria-label="Account menu"
          className={`absolute ${panelPosition} z-[100] w-72 overflow-hidden rounded-xl border border-hairline bg-surface`}
          style={{
            boxShadow:
              "0 1px 2px rgba(15,15,16,0.04), 0 12px 32px rgba(15,15,16,0.10)",
          }}
        >
          <div className="flex items-center gap-3 border-b border-hairline px-4 py-3">
            {user?.photoUrl ? (
              <img
                className="h-10 w-10 shrink-0 rounded-full object-cover"
                src={user.photoUrl}
                alt=""
                referrerPolicy="no-referrer"
              />
            ) : (
              <span
                aria-hidden="true"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-paper text-[12px] font-semibold"
              >
                {initials}
              </span>
            )}
            <div className="min-w-0">
              <div className="truncate text-[13px] font-semibold tracking-tight text-ink">
                {user?.displayName || "Signed in user"}
              </div>
              <div className="truncate text-[11px] text-muted">
                {user?.email || "No email available"}
              </div>
            </div>
          </div>

          {/* <nav className="py-1.5">
            <MenuItem
              icon={UserRound}
              label="Profile"
              onClick={handleProfile}
            />
            <MenuItem
              icon={Settings}
              label="Settings"
              onClick={() => closeAndNavigate("/settings")}
            />
          </nav> */}

          <div className="px-3 py-2.5">
            <div className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-subtle">
              Appearance
            </div>
            <div className="grid grid-cols-3 gap-0.5 rounded-md bg-ink/[0.05] p-0.5">
              {THEME_OPTIONS.map((option) => {
                const Icon = option.icon;
                const active = theme === option.value;
                return (
                  <Button
                    key={option.value}
                    variant="unstyled"
                    type="button"
                    onClick={() => setTheme(option.value)}
                    className={`flex h-7 items-center justify-center gap-1 rounded text-[11.5px] font-medium transition ${
                      active
                        ? "bg-surface text-ink shadow-sm"
                        : "text-muted hover:text-ink"
                    }`}
                  >
                    <Icon aria-hidden="true" className="h-3.5 w-3.5" />
                    {option.label}
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="border-t border-hairline">
            <Button
              variant="unstyled"
              type="button"
              role="menuitem"
              onClick={() => void handleLogout()}
              disabled={loading}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[13px] text-ink transition hover:bg-ink/[0.04] disabled:opacity-60"
              // className="group focus-ring flex w-full items-center justify-center gap-2 rounded-lg border border-danger-fg/25 bg-danger-bg px-3 py-2 text-ui-sm font-semibold text-danger-fg transition-[background-color,border-color,color,transform] duration-base ease-standard hover:border-danger-fg hover:bg-danger-fg hover:text-paper active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
            >
              <LogOut aria-hidden="true" className="h-4 w-4 text-muted" />
              {loading ? "Signing out..." : "Sign out"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof UserRound;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      variant="unstyled"
      type="button"
      role="menuitem"
      onClick={onClick}
      className="mx-1.5 flex w-[calc(100%-12px)] items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13px] text-ink transition hover:bg-ink/[0.04]"
    >
      <Icon aria-hidden="true" className="h-4 w-4 text-muted" />
      {label}
    </Button>
  );
}

export function UserAvatar({
  user,
  size = "sm",
}: {
  user?: AuthUserSummary | null;
  size?: "xs" | "sm" | "md" | "lg";
}) {
  const [failed, setFailed] = useState(false);
  const dimensions =
    size === "lg"
      ? "h-12 w-12"
      : size === "md"
        ? "h-9 w-9"
        : size === "sm"
          ? "h-8 w-8"
          : "h-6 w-6";
  const textSize =
    size === "lg"
      ? "text-[16px]"
      : size === "md"
        ? "text-[13px]"
        : "text-[12px]";
  const label = user?.displayName || user?.email || "User";
  const initials = getInitials(label);

  if (user?.photoUrl && !failed) {
    return (
      <img
        className={`${dimensions} shrink-0 rounded-full object-cover ring-1 ring-hairline`}
        src={user.photoUrl}
        alt={`${label} avatar`}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <span
      className={`${dimensions} ${textSize} inline-flex shrink-0 items-center justify-center rounded-full bg-ink font-semibold text-paper ring-1 ring-hairline`}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

function getInitials(label: string) {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return label.slice(0, 2).toUpperCase();
}
