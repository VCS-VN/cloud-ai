import { createFileRoute, redirect } from "@tanstack/react-router";
import { Monitor, Moon, Sun } from "lucide-react";
import { UserAvatar, UserMenu } from "@/components/auth/UserMenu";
import { Button } from "@/components/ui/button";
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
    <main className="min-h-screen bg-paper p-4 text-ink">
      <section className="mx-auto max-w-4xl rounded-card border border-hairline bg-surface p-6 shadow-card">
        <header className="flex flex-col gap-4 border-b border-hairline pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <UserAvatar user={user} size="lg" />
            <div className="min-w-0">
              <p className="eyebrow m-0">Settings</p>
              <h1 className="m-0 mt-1 truncate text-h2 font-semibold tracking-tight">
                Account settings
              </h1>
              <p className="m-0 mt-1 truncate text-ui-sm text-muted">
                {user.email}
              </p>
            </div>
          </div>
          <UserMenu user={user} />
        </header>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1.2fr]">
          <section className="rounded-card border border-hairline bg-chalk p-4">
            <p className="m-0 text-ui-sm font-semibold">Profile</p>
            <dl className="mt-3 grid gap-2 text-ui-sm">
              <div>
                <dt className="text-muted">Display name</dt>
                <dd className="m-0 mt-1">{user.displayName || "Not set"}</dd>
              </div>
              <div>
                <dt className="text-muted">Email</dt>
                <dd className="m-0 mt-1 break-all">{user.email}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-card border border-hairline bg-chalk p-4">
            <p className="m-0 text-ui-sm font-semibold">Appearance</p>
            <p className="m-0 mt-1 text-ui-sm leading-snug text-muted">
              Choose how Cloud AI looks on this device.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {themeOptions.map((option) => (
                <Button
                  key={option.value}
                  variant={theme === option.value ? "default" : "outline"}
                  className={`!h-auto !justify-start text-left flex-col items-start gap-1 p-3`}
                  onClick={() => setTheme(option.value)}
                >
                  <option.icon aria-hidden="true" size={18} />
                  <span className="block text-ui-sm font-semibold">
                    {option.label}
                  </span>
                  <span className="block text-caption leading-snug opacity-75">
                    {option.description}
                  </span>
                </Button>
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
