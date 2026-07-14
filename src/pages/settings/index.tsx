import { useCallback, useEffect, useState } from "react";
import { Link, getRouteApi } from "@tanstack/react-router";
import { CreditCard, Settings, User, Wallet } from "lucide-react";
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
}> = [
  { id: "profile", label: "Profile", icon: User },
  { id: "balance", label: "AI Wallet", icon: Wallet },
  { id: "payment", label: "Payment", icon: CreditCard },
  { id: "preferences", label: "Preferences", icon: Settings },
];

const SCROLL_SPY_OFFSET = 96;

export function SettingsPage() {
  const { user: initialUser } = route.useRouteContext();
  const { theme, setTheme } = useTheme();
  const [user, setUser] = useState<AuthUserSummary>(initialUser);
  const [activeSection, setActiveSection] = useState(settingsNav[0].id);
  const displayName = user.displayName || getFirstName(user.email);

  useEffect(() => {
    const sections = settingsNav
      .map(({ id }) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (sections.length === 0) return;

    function syncActiveSection() {
      const marker = SCROLL_SPY_OFFSET + 1;
      // Bottom of page: last section wins even if it's shorter than the viewport.
      if (
        window.innerHeight + window.scrollY >=
        document.body.scrollHeight - 2
      ) {
        setActiveSection(sections[sections.length - 1].id);
        return;
      }
      let current = sections[0].id;
      for (const section of sections) {
        if (section.getBoundingClientRect().top <= marker) {
          current = section.id;
        }
      }
      setActiveSection(current);
    }

    syncActiveSection();
    window.addEventListener("scroll", syncActiveSection, { passive: true });
    window.addEventListener("resize", syncActiveSection);
    return () => {
      window.removeEventListener("scroll", syncActiveSection);
      window.removeEventListener("resize", syncActiveSection);
    };
  }, []);

  const handleNavClick = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>, id: string) => {
      const target = document.getElementById(id);
      if (!target) return;
      event.preventDefault();
      const top =
        target.getBoundingClientRect().top + window.scrollY - SCROLL_SPY_OFFSET;
      window.scrollTo({ top, behavior: "smooth" });
      setActiveSection(id);
      history.replaceState(null, "", `#${id}`);
    },
    [],
  );

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
            {settingsNav.map(({ id, label, icon: Icon }) => {
              const isActive = activeSection === id;
              return (
                <a
                  key={id}
                  href={`#${id}`}
                  onClick={(event) => handleNavClick(event, id)}
                  aria-current={isActive ? "true" : undefined}
                  className={`flex h-9 shrink-0 items-center gap-2.5 rounded-md px-3 transition-colors duration-200 ${isActive ? "bg-ink/[0.05] font-medium text-ink" : "text-muted hover:bg-ink/[0.04] hover:text-ink"}`}
                >
                  <Icon aria-hidden="true" size={16} />
                  {label}
                </a>
              );
            })}
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
