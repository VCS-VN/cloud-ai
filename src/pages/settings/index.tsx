import { useState } from "react";
import { Link, getRouteApi } from "@tanstack/react-router";
import {
  BarChart3,
  CreditCard,
  FileText,
  Settings,
  ShieldAlert,
  Star,
  User,
  Users,
} from "lucide-react";
import { UserMenu } from "@/components/auth/UserMenu";
import { BalanceSummaryCard } from "@/components/profile/BalanceSummaryCard";
import type { AuthUserSummary } from "@/auth/types";
import { useTheme } from "@/theme";
import { ProfileSection } from "./components/ProfileSection";
import { PlanSection } from "./components/PlanSection";
import { UsageSection } from "./components/UsageSection";
import { PaymentSection } from "./components/PaymentSection";
import { InvoicesSection } from "./components/InvoicesSection";
import { TeamSection } from "./components/TeamSection";
import { PreferencesSection } from "./components/PreferencesSection";
import { DangerSection } from "./components/DangerSection";
import { getFirstName } from "./utils";

const route = getRouteApi("/settings");

const settingsNav: Array<{
  id: string;
  label: string;
  icon: typeof User;
  badge?: string;
}> = [
  { id: "profile", label: "Profile", icon: User },
  // { id: "plan", label: "Plan", icon: Star },
  // { id: "usage", label: "Usage", icon: BarChart3 },
  { id: "payment", label: "Payment", icon: CreditCard },
  // { id: "invoices", label: "Invoices", icon: FileText },
  // { id: "team", label: "Team", icon: Users, badge: "3" },
  { id: "preferences", label: "Preferences", icon: Settings },
];

export function SettingsPage() {
  const { user: initialUser } = route.useRouteContext();
  const { theme, setTheme } = useTheme();
  const [user, setUser] = useState<AuthUserSummary>(initialUser);
  const displayName = user.displayName || getFirstName(user.email);

  return (
    <div className="min-h-screen bg-paper text-ink">
      <nav className="sticky top-0 z-50 border-b border-hairline bg-paper/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1280px] items-center justify-between px-6 lg:px-8">
          <div className="flex items-center gap-7">
            <Link to="/dashboard" className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-ink text-paper">
                <svg
                  aria-hidden="true"
                  className="h-3.5 w-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path d="M4 7h16M4 12h16M4 17h10" />
                </svg>
              </span>
              <span className="font-semibold tracking-tight">Cloud AI</span>
            </Link>
            <div className="hidden items-center gap-1 text-ui-sm lg:flex">
              <Link
                to="/dashboard"
                className="rounded-md px-3 py-1.5 text-muted hover:bg-ink/[0.04] hover:text-ink"
              >
                Projects
              </Link>
              <a
                href="#"
                className="rounded-md px-3 py-1.5 text-muted hover:bg-ink/[0.04] hover:text-ink"
              >
                Templates
              </a>
              <a
                href="#"
                className="rounded-md px-3 py-1.5 text-muted hover:bg-ink/[0.04] hover:text-ink"
              >
                Docs
              </a>
              <Link
                to="/settings"
                className="rounded-md bg-ink/[0.04] px-3 py-1.5 font-medium text-ink"
              >
                Settings
              </Link>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <UserMenu user={user} compact placement="bottom" align="right" />
          </div>
        </div>
      </nav>

      <header className="mx-auto max-w-[1280px] px-6 pb-6 pt-10 lg:px-8">
        <p className="font-mono text-[11px] uppercase tracking-widest text-subtle">
          Workspace · {displayName}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
          Settings &amp; Billing
        </h1>
        <p className="mt-2 max-w-xl leading-relaxed text-muted">
          Manage profile, plan, billing. Changes apply as soon as you save.
        </p>
      </header>

      <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-8 px-6 pb-20 md:grid-cols-[220px_1fr] lg:grid-cols-[240px_1fr] lg:px-8">
        <aside className="self-start md:sticky md:top-20">
          <nav className="-mx-2 flex gap-1 overflow-x-auto px-2 pb-2 text-ui-sm md:mx-0 md:flex-col md:overflow-visible md:px-0 md:pb-0">
            {settingsNav.map(({ id, label, icon: Icon, badge }, index) => (
              <a
                key={id}
                href={`#${id}`}
                className={`flex h-9 shrink-0 items-center gap-2.5 rounded-md px-3 ${index === 0 ? "bg-ink/[0.05] font-medium text-ink" : "text-muted hover:bg-ink/[0.04] hover:text-ink"}`}
              >
                <Icon aria-hidden="true" size={16} />
                {label}
                {badge ? (
                  <span className="ml-auto font-mono text-[10px] text-subtle">
                    {badge}
                  </span>
                ) : null}
              </a>
            ))}
            <div className="mx-2 h-5 w-px shrink-0 bg-hairline md:mx-0 md:my-2 md:h-px md:w-auto" />
            {/* <a
              href="#danger"
              className="flex h-9 shrink-0 items-center gap-2.5 rounded-md px-3 text-rose-700 hover:bg-rose-50"
            >
              <ShieldAlert aria-hidden="true" size={16} />
              Danger zone
            </a> */}
          </nav>
        </aside>

        <main className="min-w-0 space-y-10">
          <ProfileSection
            user={user}
            displayName={displayName}
            onUserChange={setUser}
          />
          {/* <PlanSection /> */}
          {/* <UsageSection /> */}
          <BalanceSummaryCard activated={Boolean(user.episCloudTenantId)} />
          <PaymentSection user={user} />
          {/* <InvoicesSection /> */}
          {/* <TeamSection displayName={displayName} email={user.email} /> */}
          <PreferencesSection theme={theme} setTheme={setTheme} />
          {/* <DangerSection /> */}
        </main>
      </div>

      <footer className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-3 border-t border-hairline px-6 py-8 text-xs text-subtle lg:px-8">
        <div className="flex items-center gap-3">
          <span>© 2026 Cloud AI Labs</span>
          <span>·</span>
          <a href="#" className="hover:text-ink">
            Privacy
          </a>
          <a href="#" className="hover:text-ink">
            Terms
          </a>
          <a href="#" className="hover:text-ink">
            Status
          </a>
        </div>
        <div>v1.4.2 · build 1f3e4a</div>
      </footer>
    </div>
  );
}
