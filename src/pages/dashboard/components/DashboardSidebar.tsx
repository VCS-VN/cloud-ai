import {
  BarChart3,
  Bell,
  FileText,
  Grid2X2,
  Loader2,
  LogOut,
  Monitor,
  Moon,
  Settings,
  Sun,
} from "lucide-react";
import classnames from "classnames";
import { Link } from "@tanstack/react-router";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useTheme, type AppTheme } from "@/theme";
import { useSignOut } from "@/components/auth/use-sign-out";
import { getInitials } from "../utils";

export function DashboardSidebar({
  expanded,
  userLabel,
  userEmail,
  onToggle,
}: {
  expanded: boolean;
  userLabel: string;
  userEmail: string;
  onToggle: () => void;
}) {
  const initials = getInitials(userLabel || userEmail);

  return (
    <aside
      className="dashboard-side-shell hidden xl:flex"
      data-expanded={expanded ? "true" : "false"}
      aria-label="Main menu"
    >
      <div>
        <div className="mb-5 flex min-w-0 items-center justify-between">
          <div className="dashboard-side-brand flex min-w-0 items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-ink text-paper shadow-sm">
              <svg
                aria-hidden="true"
                className="h-[19px] w-[19px]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.9}
              >
                <path d="M4 7h16M4 12h16M4 17h10" />
              </svg>
            </span>
            <div className="dashboard-side-copy min-w-0">
              <div className="text-ui-sm font-semibold tracking-tight text-ink">
                Cloud AI
              </div>
              <div className="text-[11px] text-muted">Workspace</div>
            </div>
          </div>
          <button
            type="button"
            className="dashboard-side-toggle"
            aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
            aria-expanded={expanded}
            onClick={onToggle}
          >
            <svg
              aria-hidden="true"
              className="h-5 w-5 transition-transform duration-base"
              data-chevron
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </div>
        <nav className="flex flex-col gap-2">
          <Link
            to="/dashboard"
            className={classnames("dashboard-side-link", {
              "gap-3": expanded,
            })}
            title="Projects"
            aria-label="projects"
          >
            <Grid2X2 aria-hidden="true" size={24} />
            <span className="dashboard-side-label">Projects</span>
          </Link>
          <a
            href="#"
            className={classnames("dashboard-side-link", {
              "gap-3": expanded,
            })}
            title="Templates"
            aria-label="Templates"
          >
            <FileText aria-hidden="true" size={24} />
            <span className="dashboard-side-label">Templates</span>
          </a>
          <a
            href="#"
            className={classnames("dashboard-side-link", {
              "gap-3": expanded,
            })}
            title="Analytics"
            aria-label="Analytics"
          >
            <BarChart3 aria-hidden="true" size={24} />
            <span className="dashboard-side-label">Analytics</span>
          </a>
        </nav>
      </div>

      <div className="flex flex-col gap-2">
        <div className="dashboard-side-divider" />
        <button
          type="button"
          className={classnames("dashboard-side-link", {
            "gap-3": expanded,
          })}
          title="Notifications"
          aria-label="Notifications"
        >
          <Bell aria-hidden="true" size={24} />
          <span className="dashboard-side-label">Notifications</span>
        </button>
        <Link
          to="/settings"
          className={classnames("dashboard-side-link", {
            "gap-3": expanded,
          })}
          title="Settings"
          aria-label="Settings"
        >
          <Settings aria-hidden="true" size={24} />
          <span className="dashboard-side-label">Settings</span>
        </Link>
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={classnames("dashboard-side-profile", {
                "gap-3": expanded,
              })}
              title={userLabel}
              aria-label={`${userLabel} — account menu`}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-semibold text-paper shadow-sm ring-4 ring-paper">
                {initials}
              </span>
              <span
                className={classnames(
                  "dashboard-side-label min-w-0 text-left",
                  {
                    hidden: !expanded,
                  },
                )}
              >
                <span className="block truncate text-ui-sm font-medium text-ink">
                  {userLabel}
                </span>
                <span className="block truncate text-[11px] text-muted">
                  {userEmail}
                </span>
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent
            side="right"
            align="end"
            sideOffset={12}
            className="w-64 p-3"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-semibold text-paper">
                {initials}
              </span>
              <div className="min-w-0">
                <p className="m-0 truncate text-ui-sm font-semibold text-ink">
                  {userLabel}
                </p>
                <p className="m-0 truncate text-[11px] text-muted">
                  {userEmail}
                </p>
              </div>
            </div>
            <SidebarThemeSwitcher />
            <div className="pt-3">
              <SidebarSignOutButton />
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </aside>
  );
}

const SIDEBAR_THEME_OPTIONS: Array<{
  value: AppTheme;
  label: string;
  icon: typeof Moon;
}> = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

function SidebarThemeSwitcher() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="pt-3">
      <p className="m-0 mb-2 text-eyebrow font-mono uppercase tracking-wide text-subtle">
        Theme
      </p>
      <div className="grid grid-cols-3 gap-1 rounded-lg border border-hairline bg-chalk p-0.5">
        {SIDEBAR_THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
          const active = theme === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setTheme(value)}
              aria-pressed={active}
              className={classnames(
                "flex flex-col items-center gap-1 rounded-md py-2 text-[11px] font-medium transition-colors duration-base focus-ring",
                active
                  ? "bg-surface text-ink shadow-sm"
                  : "text-muted hover:text-ink",
              )}
            >
              <Icon aria-hidden="true" size={16} />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SidebarSignOutButton() {
  const { signOut, loading } = useSignOut();

  return (
    <button
      type="button"
      onClick={() => void signOut()}
      disabled={loading}
      aria-label="Sign out"
      className="group focus-ring flex w-full items-center justify-center gap-2 rounded-lg border border-danger-fg/25 bg-danger-bg px-3 py-2 text-ui-sm font-semibold text-danger-fg transition-[background-color,border-color,color,transform] duration-base ease-standard hover:border-danger-fg hover:bg-danger-fg hover:text-paper active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? (
        <Loader2 aria-hidden="true" size={16} className="animate-spin" />
      ) : (
        <LogOut
          aria-hidden="true"
          size={16}
          className="transition-transform duration-base group-hover:-translate-x-0.5"
        />
      )}
      {loading ? "Signing out..." : "Sign out"}
    </button>
  );
}
