import { createFileRoute, redirect } from "@tanstack/react-router";
import { Monitor, Moon, Sun } from "lucide-react";
import { UserAvatar, UserMenu } from "@/components/auth/UserMenu";
import { getCurrentUser } from "@/server/functions/auth";
import { useTheme, type AppTheme } from "@/theme";

const themeOptions: Array<{
  value: AppTheme;
  label: string;
  description: string;
  icon: typeof Moon;
}> = [
  {
    value: "dark",
    label: "Dark",
    description: "Use the deep builder interface.",
    icon: Moon,
  },
  {
    value: "light",
    label: "Light",
    description: "Use the bright builder interface.",
    icon: Sun,
  },
  {
    value: "system",
    label: "System",
    description: "Follow your device appearance.",
    icon: Monitor,
  },
];

export const Route = createFileRoute("/settings/")({
  beforeLoad: async () => {
    const { user } = await getCurrentUser();
    if (!user) throw redirect({ to: "/" });
    return { user };
  },
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = Route.useRouteContext();
  const { theme, setTheme } = useTheme();

  return (
    <main className="min-h-screen bg-[var(--app-bg)] p-md text-[var(--app-text)]">
      <section className="mx-auto max-w-4xl rounded-lg border border-[var(--app-border)] bg-[var(--app-panel)] p-lg transition-colors duration-300">
        <header className="flex flex-col gap-md border-b border-[var(--app-border)] pb-md sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-center gap-sm">
            <UserAvatar user={user} size="lg" />
            <div className="min-w-0">
              <p className="m-0 font-mono text-caption uppercase tracking-[0.6px] text-[var(--app-muted)]">
                Settings
              </p>
              <h1 className="m-0 mt-xxs truncate text-headline font-[540] tracking-[-0.26px]">
                Account settings
              </h1>
              <p className="m-0 mt-xxs truncate text-body-sm text-[var(--app-muted)]">
                {user.email}
              </p>
            </div>
          </div>
          <UserMenu user={user} />
        </header>

        <div className="mt-lg grid gap-md lg:grid-cols-[1fr_1.2fr]">
          <section className="rounded-md border border-[var(--app-border)] bg-[var(--app-control)] p-md transition-colors duration-300">
            <p className="m-0 text-body-sm font-[620]">Profile</p>
            <dl className="mt-sm grid gap-xs text-body-sm">
              <div>
                <dt className="text-[var(--app-muted)]">Display name</dt>
                <dd className="m-0 mt-xxs">{user.displayName || "Not set"}</dd>
              </div>
              <div>
                <dt className="text-[var(--app-muted)]">Email</dt>
                <dd className="m-0 mt-xxs break-all">{user.email}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-md border border-[var(--app-border)] bg-[var(--app-control)] p-md transition-colors duration-300">
            <p className="m-0 text-body-sm font-[620]">Appearance</p>
            <p className="m-0 mt-xxs text-body-sm leading-[1.5] text-[var(--app-muted)]">
              Choose how Cloud AI looks on this device.
            </p>
            <div className="mt-sm grid gap-xs sm:grid-cols-3">
              {themeOptions.map((option) => (
                <button
                  key={option.value}
                  className={`motion-press rounded-md border p-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-border-strong)] ${theme === option.value ? "border-[var(--app-accent)] bg-[var(--app-selected-bg)] text-[var(--app-selected-text)] [&_svg]:text-[var(--app-icon-selected)]" : "border-[var(--app-border)] bg-[var(--app-panel)] text-[var(--app-muted)] hover:border-[var(--app-border-strong)] hover:text-[var(--app-text)] [&_svg]:text-[var(--app-icon-muted)] hover:[&_svg]:text-[var(--app-icon)]"}`}
                  type="button"
                  onClick={() => setTheme(option.value)}
                >
                  <option.icon aria-hidden="true" size={18} />
                  <span className="mt-xs block text-body-sm font-[620]">
                    {option.label}
                  </span>
                  <span className="mt-xxs block text-caption leading-4 opacity-72">
                    {option.description}
                  </span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
