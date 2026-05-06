import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  type LucideIcon,
  ChevronLeft,
  ChevronRight,
  Loader2,
  LogOut,
  Monitor,
  Moon,
  Settings,
  Sun,
  UserRound,
} from "lucide-react";
import { signOutFirebaseClient } from "@/auth/firebase-client";
import type { AuthUserSummary } from "@/auth/types";
import { logout } from "@/server/functions/auth";
import { useTheme, type AppTheme } from "@/theme";

type UserMenuProps = {
  user?: AuthUserSummary | null;
  onProfile?: () => void;
  compact?: boolean;
  placement?: "top" | "bottom";
  align?: "left" | "right";
};

const themeOptions: Array<{
  value: AppTheme;
  label: string;
  icon: LucideIcon;
}> = [
  { value: "dark", label: "Dark", icon: Moon },
  { value: "light", label: "Light", icon: Sun },
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
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;

    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setAppearanceOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setAppearanceOpen(false);
      }
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
      await signOutFirebaseClient().catch(() => undefined);
      setOpen(false);
      setAppearanceOpen(false);
      await navigate({ to: result.redirectTo });
    } finally {
      setLoading(false);
    }
  }

  function closeAndNavigate(to: string) {
    setOpen(false);
    setAppearanceOpen(false);
    void navigate({ to: to as never });
  }

  function handleProfile() {
    if (onProfile) {
      setOpen(false);
      setAppearanceOpen(false);
      onProfile();
      return;
    }
    closeAndNavigate("/settings/profile");
  }

  const menuPosition = `${placement === "top" ? "bottom-[calc(100%+8px)]" : "top-[calc(100%+8px)]"} ${align === "right" ? "right-0" : "left-0"}`;
  const userLabel = user?.displayName || user?.email || "Account";

  return (
    <div className="relative" ref={menuRef}>
      <button
        className={
          compact
            ? "inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--app-sidebar-border)] bg-[var(--app-sidebar-control)] text-[var(--app-sidebar-text)] shadow-none transition-all duration-200 ease-out hover:bg-[var(--app-sidebar-control-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60"
            : "inline-flex h-10 items-center gap-xs rounded-md border border-[var(--app-border)] bg-[var(--app-control)] px-xs pr-sm text-[13px] text-[var(--app-icon-muted)] transition-all duration-200 ease-out hover:bg-[var(--app-panel)] hover:text-[var(--app-icon)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60"
        }
        type="button"
        onClick={() => setOpen((current) => !current)}
        disabled={loading}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={open ? "Close account menu" : "Open account menu"}
        title={user?.email ?? userLabel}
      >
        <div className="flex gap-2 items-center">
          <UserAvatar user={user} size={compact ? "sm" : "xs"} />

          {!compact ? (
            <span className="max-w-[160px] truncate">{userLabel}</span>
          ) : null}
        </div>
        {!compact ? (
          <span className="max-w-[160px] truncate">{userLabel}</span>
        ) : null}
      </button>

      {open ? (
        <div
          className={`absolute ${menuPosition} z-50 w-[min(320px,calc(100vw-32px))] overflow-hidden rounded-lg border border-[var(--app-dropdown-border)] bg-[var(--app-dropdown-bg)] text-[var(--app-dropdown-text)] shadow-none ring-1 ring-[var(--app-dropdown-border)] animate-in fade-in zoom-in-95 duration-150`}
          role="menu"
          aria-label="Account menu"
        >
          <div className="flex items-center gap-sm border-b border-[var(--app-dropdown-border)] p-md">
            <UserAvatar user={user} size="lg" />
            <div className="min-w-0">
              <p className="m-0 truncate text-[16px] font-[720] leading-tight tracking-[-0.02em]">
                {user?.displayName || "Signed in user"}
              </p>
              <p className="m-0 mt-xxs truncate text-[13px] leading-5 text-[var(--app-dropdown-muted)]">
                {user?.email || "No email available"}
              </p>
            </div>
          </div>

          {appearanceOpen ? (
            <div className="py-xs">
              <MenuButton
                icon={ChevronLeft}
                label="Appearance"
                onClick={() => setAppearanceOpen(false)}
              />
              <div className="my-xs h-px bg-[var(--app-dropdown-border)]" />
              {themeOptions.map((option) => (
                <MenuButton
                  key={option.value}
                  icon={option.icon}
                  label={option.label}
                  selected={theme === option.value}
                  onClick={() => {
                    setTheme(option.value);
                    setAppearanceOpen(false);
                    setOpen(false);
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="py-xs">
              <MenuButton
                icon={UserRound}
                label="Profile"
                onClick={handleProfile}
              />
              <MenuButton
                icon={Settings}
                label="Settings"
                onClick={() => closeAndNavigate("/settings")}
              />
              <MenuButton
                icon={Moon}
                label="Appearance"
                trailing={<ChevronRight aria-hidden="true" size={18} />}
                onClick={() => setAppearanceOpen(true)}
              />
              <div className="my-xs h-px bg-[var(--app-dropdown-border)]" />
              <MenuButton
                icon={LogOut}
                label={loading ? "Signing out..." : "Sign out"}
                loading={loading}
                onClick={() => void handleLogout()}
              />
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function MenuButton({
  icon: Icon,
  label,
  trailing,
  selected = false,
  loading = false,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  trailing?: ReactNode;
  selected?: boolean;
  loading?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`flex h-12 w-full items-center gap-sm border-0 px-md text-left text-[15px] font-[560] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--app-focus-ring)] ${selected ? "bg-[var(--app-dropdown-control-active)] text-[var(--app-selected-text)] [&_svg]:text-[var(--app-icon-selected)]" : "bg-transparent text-[var(--app-dropdown-text)] hover:bg-[var(--app-dropdown-control-hover)] [&_svg]:text-[var(--app-icon-muted)]"}`}
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={loading}
    >
      {loading ? (
        <Loader2
          aria-hidden="true"
          className="shrink-0 animate-spin text-[var(--app-icon-muted)]"
          size={19}
        />
      ) : (
        <Icon
          aria-hidden="true"
          className="shrink-0 text-[var(--app-icon-muted)]"
          size={19}
        />
      )}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {trailing ??
        (selected ? (
          <span
            className="h-2 w-2 rounded-full bg-[var(--app-accent)]"
            aria-hidden="true"
          />
        ) : null)}
    </button>
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
        className={`${dimensions} shrink-0 rounded-full object-cover ring-1 ring-[var(--app-dropdown-border)]`}
        src={user.photoUrl}
        alt={`${label} avatar`}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <span
      className={`${dimensions} ${textSize} inline-flex shrink-0 items-center justify-center rounded-full bg-[var(--color-block-lilac)] font-[720] text-[var(--app-on-color-block)] ring-1 ring-[var(--app-dropdown-border)]`}
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
