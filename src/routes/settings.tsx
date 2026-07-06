import { useState } from "react";
import { Link, createFileRoute, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  BarChart3,
  Check,
  Copy,
  CreditCard,
  FileText,
  Monitor,
  Moon,
  Plus,
  Settings,
  ShieldAlert,
  Star,
  Sun,
  User,
  Users,
} from "lucide-react";
import { UserAvatar, UserMenu } from "@/components/auth/UserMenu";
import { AddPaymentMethodDialog } from "@/components/profile/AddPaymentMethodDialog";
import { EpisCloudActivateDialog } from "@/components/profile/EpisCloudActivateDialog";
import { Button } from "@/components/ui/button";
import { activateEpisCloud, getCurrentUser } from "@/server/functions/auth";
import type { AuthUserSummary } from "@/auth/types";
import { useTheme, type AppTheme } from "@/theme";

const activatedAtFormatter = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const themeOptions: Array<{
  value: AppTheme;
  label: string;
  icon: typeof Moon;
}> = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

const settingsNav: Array<{
  id: string;
  label: string;
  icon: typeof User;
  badge?: string;
}> = [
  { id: "profile", label: "Profile", icon: User },
  { id: "plan", label: "Plan", icon: Star },
  { id: "usage", label: "Usage", icon: BarChart3 },
  { id: "payment", label: "Payment", icon: CreditCard },
  { id: "invoices", label: "Invoices", icon: FileText },
  { id: "team", label: "Team", icon: Users, badge: "3" },
  { id: "preferences", label: "Preferences", icon: Settings },
];

export const Route = createFileRoute("/settings")({
  beforeLoad: async () => {
    const { user } = await getCurrentUser();
    if (!user) throw redirect({ to: "/" });
    return { user };
  },
  component: SettingsPage,
});

function SettingsPage() {
  const { user: initialUser } = Route.useRouteContext();
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
            <Link
              to="/dashboard"
              className="hidden text-ui-sm text-muted hover:text-ink md:inline"
            >
              Back to Projects
            </Link>
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
          Manage profile, plan, billing, and team settings. Changes apply as
          soon as you save.
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
            <a
              href="#danger"
              className="flex h-9 shrink-0 items-center gap-2.5 rounded-md px-3 text-rose-700 hover:bg-rose-50"
            >
              <ShieldAlert aria-hidden="true" size={16} />
              Danger zone
            </a>
          </nav>
        </aside>

        <main className="min-w-0 space-y-10">
          <ProfileSection
            user={user}
            displayName={displayName}
            onUserChange={setUser}
          />
          <PlanSection />
          <UsageSection />
          <PaymentSection user={user} />
          <InvoicesSection />
          <TeamSection displayName={displayName} email={user.email} />
          <PreferencesSection theme={theme} setTheme={setTheme} />
          <DangerSection />
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

function ProfileSection({
  user,
  displayName,
  onUserChange,
}: {
  user: AuthUserSummary;
  displayName: string;
  onUserChange: (user: AuthUserSummary) => void;
}) {
  return (
    <section
      id="profile"
      className="scroll-mt-20 rounded-2xl border border-hairline bg-surface"
    >
      <header className="flex items-center justify-between border-b border-hairline px-6 py-5">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Profile</h2>
          <p className="mt-0.5 text-xs text-muted">
            Shown on projects and collaboration invites.
          </p>
        </div>
      </header>
      <div className="grid grid-cols-1 items-start gap-6 p-6 md:grid-cols-[112px_1fr]">
        <div>
          <UserAvatar user={user} size="lg" />
          <button className="mt-2 text-xs text-muted hover:text-ink">
            Change photo
          </button>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SettingsInput label="Full name" value={displayName} />
          <SettingsInput
            label="Username"
            value={getFirstName(user.email)}
            prefix="lumen.app/"
            mono
          />
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-xs font-medium text-muted">Email</span>
            <input
              className="h-10 rounded-lg border border-hairline bg-paper px-3 text-ui-sm outline-none focus:border-ink"
              value={user.email}
              readOnly
            />
            <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-emerald-700">
              <Check aria-hidden="true" size={12} />
              Verified · 2026-04-12
            </span>
          </label>
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-xs font-medium text-muted">Bio</span>
            <textarea
              rows={2}
              className="rounded-lg border border-hairline bg-paper px-3 py-2 text-ui-sm leading-relaxed outline-none focus:border-ink"
              defaultValue="Designer & founder. Building more prototypes and fewer decks."
            />
          </label>
        </div>
      </div>
      <footer className="flex items-center justify-end gap-2 border-t border-hairline px-6 py-4">
        <Button variant="ghost" className="!h-9">
          Cancel
        </Button>
        <Button className="!h-9">Save changes</Button>
      </footer>
      <EpisCloudSection user={user} onUserChange={onUserChange} />
    </section>
  );
}

function EpisCloudSection({
  user,
  onUserChange,
}: {
  user: AuthUserSummary;
  onUserChange: (user: AuthUserSummary) => void;
}) {
  const activateEpisCloudFn = useServerFn(activateEpisCloud);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [activating, setActivating] = useState(false);
  const [activateError, setActivateError] = useState<string | null>(null);
  const [tenantIdCopied, setTenantIdCopied] = useState(false);

  async function handleActivate() {
    if (activating) return;
    setActivating(true);
    setActivateError(null);
    try {
      const updated = await activateEpisCloudFn();
      onUserChange(updated);
      setConfirmOpen(false);
    } catch (error) {
      setActivateError(
        error instanceof Error
          ? error.message
          : "Could not activate EpisCloud. Please try again.",
      );
    } finally {
      setActivating(false);
    }
  }

  async function handleCopyTenantId() {
    if (!user.episCloudTenantId) return;
    try {
      await navigator.clipboard.writeText(user.episCloudTenantId);
      setTenantIdCopied(true);
      setTimeout(() => setTenantIdCopied(false), 1500);
    } catch {
      // Clipboard access can be denied by the browser; nothing to recover from here.
    }
  }

  return (
    <div className="border-t border-hairline px-6 py-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-ui-sm font-semibold tracking-tight text-ink">
            EpisCloud
          </h3>
          <p className="mt-0.5 max-w-prose text-xs text-muted">
            EpisCloud powers the AI features on your storefront. Activate it to
            create your account with EpisCloud.
          </p>
        </div>
        {user.episCloudTenantId ? (
          <span className="inline-flex h-6 shrink-0 items-center gap-1 rounded-full border border-success-bg bg-success-bg px-2 text-[11px] font-medium text-success-fg">
            <span className="h-1.5 w-1.5 rounded-full bg-success-dot" />
            Activated
          </span>
        ) : null}
      </div>

      {user.episCloudTenantId ? (
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <div>
            <p className="m-0 text-[11px] uppercase tracking-wide text-subtle">
              Activated on
            </p>
            <p className="m-0 mt-0.5 text-ui-sm text-ink">
              {user.episCloudActivatedAt
                ? activatedAtFormatter.format(
                    new Date(user.episCloudActivatedAt),
                  )
                : "—"}
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex items-center justify-between gap-3">
          <span aria-live="polite" className="text-ui-sm">
            {activateError ? (
              <span className="text-danger-fg">{activateError}</span>
            ) : null}
          </span>
          <Button
            type="button"
            className="!h-9"
            onClick={() => setConfirmOpen(true)}
          >
            Activate EpisCloud
          </Button>
        </div>
      )}

      <EpisCloudActivateDialog
        open={confirmOpen}
        activating={activating}
        error={activateError}
        onCancel={() => {
          setConfirmOpen(false);
          setActivateError(null);
        }}
        onConfirm={handleActivate}
      />
    </div>
  );
}

function PlanSection() {
  const plans = [
    {
      name: "Hobby",
      price: "$0",
      suffix: "/ month",
      action: "Downgrade",
      muted: true,
      features: [
        "3 projects max",
        "100 AI credits/month",
        "lumen.app subdomain",
        "No custom domain",
      ],
    },
    {
      name: "Pro",
      price: "$24",
      suffix: "/ month",
      action: "Current — Manage",
      active: true,
      features: [
        "25 projects",
        "1,000 AI credits/month",
        "Custom domain + SSL",
        "Unlimited version history",
        "Export code to Vercel/Netlify",
      ],
    },
    {
      name: "Team",
      price: "$48",
      suffix: "/ month / seat",
      action: "Upgrade",
      features: [
        "Everything in Pro",
        "5,000 shared credits",
        "SSO (SAML / Google Workspace)",
        "Audit log + role-based access",
        "Priority support (4h)",
      ],
    },
  ];

  return (
    <section
      id="plan"
      className="scroll-mt-20 overflow-hidden rounded-2xl border border-hairline bg-surface"
    >
      <header className="border-b border-hairline px-6 py-5">
        <h2 className="text-base font-semibold tracking-tight">Plan</h2>
        <p className="mt-0.5 text-xs text-muted">
          You are on <span className="font-medium text-ink">Pro</span>. Plan
          changes apply next billing cycle.
        </p>
      </header>
      <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-3">
        {plans.map((plan) => (
          <article
            key={plan.name}
            className={`relative rounded-xl bg-paper p-5 ${plan.active ? "border-2 border-ink" : "border border-hairline"}`}
          >
            {plan.active ? (
              <span className="absolute -top-2.5 left-5 inline-flex h-5 items-center rounded-full bg-ink px-2 font-mono text-[10px] uppercase tracking-widest text-paper">
                Current
              </span>
            ) : null}
            <div className="flex items-baseline justify-between">
              <div
                className={`font-mono text-[11px] uppercase tracking-widest ${plan.active ? "text-ink" : "text-subtle"}`}
              >
                {plan.name}
              </div>
              {plan.active ? (
                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />{" "}
                  Active
                </span>
              ) : null}
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="font-mono text-3xl font-semibold tracking-tight">
                {plan.price}
              </span>
              <span className="text-ui-sm text-muted">{plan.suffix}</span>
            </div>
            <Button
              variant={plan.active ? "default" : "outline"}
              className="mt-4 w-full !h-9"
            >
              {plan.action}
            </Button>
            <ul
              className={`mt-4 space-y-1.5 text-[13px] ${plan.active ? "text-ink" : "text-muted"}`}
            >
              {plan.features.map((feature) => (
                <li key={feature}>✓ {feature}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline bg-chalk/50 px-6 py-4">
        <div className="text-xs text-muted">
          Cycle: <span className="font-medium text-ink">Monthly</span> · Switch
          to yearly and save{" "}
          <span className="font-mono font-medium text-emerald-700">20%</span>
        </div>
        <button className="text-xs text-ink underline-offset-4 hover:underline">
          Switch to yearly →
        </button>
      </div>
    </section>
  );
}

function UsageSection() {
  return (
    <section
      id="usage"
      className="scroll-mt-20 rounded-2xl border border-hairline bg-surface"
    >
      <header className="flex items-center justify-between border-b border-hairline px-6 py-5">
        <div>
          <h2 className="text-base font-semibold tracking-tight">
            Usage this month
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            Resets on <span className="font-mono">06/28/2026</span>. Metrics
            refresh every 5 minutes.
          </p>
        </div>
        <button className="text-xs text-muted hover:text-ink">
          Export CSV →
        </button>
      </header>
      <div className="m-6 grid grid-cols-1 overflow-hidden rounded-xl border border-hairline bg-hairline md:grid-cols-3">
        <UsageCard
          label="AI credits"
          value="650"
          max="/ 1,000"
          percent="65%"
          note="12 credits/day average · 350 left"
        />
        <UsageCard
          label="Active projects"
          value="12"
          max="/ 25"
          percent="48%"
          note="5 deployed · 3 drafts"
        />
        <UsageCard
          label="Preview bandwidth"
          value="8.4"
          max="GB / 50 GB"
          percent="17%"
          note="Mostly from Stellar (4.1 GB)"
        />
      </div>
      <div className="px-6 pb-6">
        <div className="rounded-xl border border-hairline bg-paper p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-xs font-medium">
              Credits by day · past 30 days
            </div>
            <div className="font-mono text-[11px] text-subtle">
              avg 21.7/day
            </div>
          </div>
          <div className="flex h-32 items-end gap-1">
            {[
              35, 48, 22, 62, 78, 55, 28, 70, 88, 92, 74, 42, 58, 30, 18, 50,
              64, 84, 98, 80, 62, 48, 32, 58, 72, 82, 55, 45, 68, 90,
            ].map((height, index) => (
              <div
                key={index}
                className="flex-1 rounded-t-sm bg-muted/40 last:bg-ink"
                style={{ height: `${height}%` }}
              />
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between font-mono text-[10px] text-subtle">
            <span>06/05</span>
            <span>06/12</span>
            <span>06/19</span>
            <span>06/26</span>
            <span>Today</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function PaymentSection({ user }: { user: AuthUserSummary }) {
  const [addOpen, setAddOpen] = useState(false);
  const activated = Boolean(user.episCloudTenantId);
  return (
    <section
      id="payment"
      className="scroll-mt-20 rounded-2xl border border-hairline bg-surface"
    >
      <header className="border-b border-hairline px-6 py-5">
        <h2 className="text-base font-semibold tracking-tight">
          Payment methods
        </h2>
        <p className="mt-0.5 text-xs text-muted">
          Primary card is charged automatically on the{" "}
          <span className="font-mono">28th</span> each month.
        </p>
      </header>
      <div className="space-y-3 p-6">
        <button
          type="button"
          disabled={!activated}
          onClick={() => setAddOpen(true)}
          className="mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-hairline text-ui-sm font-medium text-muted hover:border-ink/30 hover:text-ink disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-hairline disabled:hover:text-muted"
        >
          <Plus aria-hidden="true" size={16} />
          Add payment method
        </button>
        {!activated ? (
          <p className="m-0 text-center text-[11px] text-subtle">
            Activate EpisCloud in your profile to add a payment method.
          </p>
        ) : null}
        <AddPaymentMethodDialog
          open={addOpen}
          onClose={() => setAddOpen(false)}
        />
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SettingsInput label="Tax ID / VAT" value="TAX 0314887621" mono />
          <SettingsInput
            label="Billing address"
            value="48 Nguyen Hue, District 1, HCMC"
          />
        </div>
      </div>
    </section>
  );
}

function InvoicesSection() {
  const invoices = [
    ["INV-2026-005", "05/28/2026", "Pro plan · May", "$24.00", "Paid"],
    ["INV-2026-004", "04/28/2026", "Pro plan · April", "$24.00", "Paid"],
    [
      "INV-2026-003",
      "03/28/2026",
      "Pro plan · March + add-on credits",
      "$36.00",
      "Paid",
    ],
    ["INV-2026-002", "02/28/2026", "Pro plan · February", "$24.00", "Refunded"],
    ["INV-2026-001", "01/28/2026", "Pro plan · January", "$24.00", "Paid"],
  ];
  return (
    <section
      id="invoices"
      className="scroll-mt-20 rounded-2xl border border-hairline bg-surface"
    >
      <header className="flex items-center justify-between border-b border-hairline px-6 py-5">
        <h2 className="text-base font-semibold tracking-tight">
          Recent invoices
        </h2>
        <button className="text-xs text-muted hover:text-ink">
          View all →
        </button>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full text-ui-sm">
          <thead>
            <tr className="border-b border-hairline text-left font-mono text-[11px] uppercase tracking-widest text-subtle">
              <th className="px-6 py-3 font-medium">Number</th>
              <th className="px-3 py-3 font-medium">Date</th>
              <th className="px-3 py-3 font-medium">Description</th>
              <th className="px-3 py-3 text-right font-medium">Amount</th>
              <th className="px-3 py-3 font-medium">Status</th>
              <th className="px-6 py-3" />
            </tr>
          </thead>
          <tbody>
            {invoices.map(([number, date, description, amount, status]) => (
              <tr
                key={number}
                className="border-b border-hairline hover:bg-chalk/50 last:border-b-0"
              >
                <td className="px-6 py-3.5 font-mono">{number}</td>
                <td className="px-3 py-3.5 font-mono text-muted">{date}</td>
                <td className="px-3 py-3.5">{description}</td>
                <td className="px-3 py-3.5 text-right font-mono">{amount}</td>
                <td className="px-3 py-3.5">
                  <StatusPill status={status} />
                </td>
                <td className="px-6 py-3.5 text-right">
                  <a href="#" className="text-xs text-muted hover:text-ink">
                    PDF →
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TeamSection({
  displayName,
  email,
}: {
  displayName: string;
  email: string;
}) {
  return (
    <section
      id="team"
      className="scroll-mt-20 rounded-2xl border border-hairline bg-surface"
    >
      <header className="flex items-center justify-between border-b border-hairline px-6 py-5">
        <div>
          <h2 className="text-base font-semibold tracking-tight">
            Team workspace
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            Invite collaborators to edit projects. Pro supports up to{" "}
            <span className="font-mono">3</span> seats.
          </p>
        </div>
        <Button className="!h-9">
          <Plus aria-hidden="true" size={14} /> Invite member
        </Button>
      </header>
      <ul className="divide-y divide-hairline">
        <TeamMember
          initials="TM"
          name={displayName}
          note="(you)"
          email={email}
          date="2026-01-08"
          role="Owner"
        />
        <TeamMember
          initials="LH"
          name="Linh Hoang"
          email="linh@maple.studio"
          date="2026-03-22"
          role="Editor"
        />
        <TeamMember
          initials="AT"
          name="An Tran"
          note="(pending)"
          email="an@example.com"
          date="Invited 2 days ago"
          role="Resend"
        />
      </ul>
    </section>
  );
}

function PreferencesSection({
  theme,
  setTheme,
}: {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
}) {
  const [toggles, setToggles] = useState({
    email: true,
    preview: true,
    credits: false,
    beta: false,
  });
  return (
    <section
      id="preferences"
      className="scroll-mt-20 rounded-2xl border border-hairline bg-surface"
    >
      <header className="border-b border-hairline px-6 py-5">
        <h2 className="text-base font-semibold tracking-tight">Preferences</h2>
        <p className="mt-0.5 text-xs text-muted">
          Applies to your Cloud AI account.
        </p>
      </header>
      <ul className="divide-y divide-hairline">
        <ToggleRow
          title="Email when builds finish"
          description="Send a summary whenever Cloud AI finishes a project build."
          enabled={toggles.email}
          onToggle={() => setToggles((v) => ({ ...v, email: !v.email }))}
        />
        <ToggleRow
          title="Automatically deploy previews"
          description="Each new AI message creates a shareable preview URL."
          enabled={toggles.preview}
          onToggle={() => setToggles((v) => ({ ...v, preview: !v.preview }))}
        />
        <ToggleRow
          title="Warn when credits run low"
          description="Notify me when fewer than 100 credits remain."
          enabled={toggles.credits}
          onToggle={() => setToggles((v) => ({ ...v, credits: !v.credits }))}
        />
        <ToggleRow
          title="Join Beta"
          description="Get new features early — they may be unstable."
          enabled={toggles.beta}
          onToggle={() => setToggles((v) => ({ ...v, beta: !v.beta }))}
        />
        <li className="flex items-center justify-between gap-4 px-6 py-4">
          <div>
            <div className="text-ui-sm font-medium">Interface theme</div>
            <div className="mt-0.5 text-xs text-muted">
              Choose how Cloud AI appears on this device.
            </div>
          </div>
          <div className="grid grid-cols-3 gap-0.5 rounded-md bg-ink/[0.05] p-0.5">
            {themeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setTheme(option.value)}
                className={`flex h-8 items-center justify-center gap-1 rounded px-2 text-[11.5px] font-medium transition ${theme === option.value ? "bg-surface text-ink shadow-sm" : "text-muted"}`}
              >
                <option.icon aria-hidden="true" size={14} /> {option.label}
              </button>
            ))}
          </div>
        </li>
      </ul>
    </section>
  );
}

function DangerSection() {
  return (
    <section
      id="danger"
      className="scroll-mt-20 rounded-2xl border border-rose-200 bg-rose-50/60"
    >
      <header className="border-b border-rose-200 px-6 py-5">
        <h2 className="text-base font-semibold tracking-tight text-rose-800">
          Danger zone
        </h2>
        <p className="mt-0.5 text-xs text-rose-700/80">
          Actions cannot be undone. Make sure before continuing.
        </p>
      </header>
      <div className="divide-y divide-rose-200">
        <DangerRow
          title="Transfer workspace ownership"
          description="Move ownership to another member. You will become an Editor."
          action="Transfer"
        />
        <DangerRow
          title="Export all data"
          description="Download a ZIP with HTML, assets, and history for every project."
          action="Export .zip"
        />
        <DangerRow
          title="Delete account"
          description="Permanently delete workspace, projects, and all versions. Recovery is not possible."
          action="Delete account"
          destructive
        />
      </div>
    </section>
  );
}

function SettingsInput({
  label,
  value,
  prefix,
  mono,
}: {
  label: string;
  value: string;
  prefix?: string;
  mono?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted">{label}</span>
      {prefix ? (
        <div className="flex h-10 items-center rounded-lg border border-hairline bg-paper px-3 text-ui-sm font-mono">
          <span className="text-subtle">{prefix}</span>
          <input
            className="ml-1 flex-1 bg-transparent outline-none"
            defaultValue={value}
          />
        </div>
      ) : (
        <input
          className={`h-10 rounded-lg border border-hairline bg-paper px-3 text-ui-sm outline-none focus:border-ink ${mono ? "font-mono" : ""}`}
          defaultValue={value}
        />
      )}
    </label>
  );
}

function UsageCard({
  label,
  value,
  max,
  percent,
  note,
}: {
  label: string;
  value: string;
  max: string;
  percent: string;
  note: string;
}) {
  return (
    <div className="bg-surface p-5">
      <div className="font-mono text-[11px] uppercase tracking-widest text-subtle">
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="font-mono text-3xl font-semibold tracking-tight">
          {value}
        </span>
        <span className="text-ui-sm text-muted">{max}</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-hairline">
        <div className="h-full bg-ink" style={{ width: percent }} />
      </div>
      <div className="mt-2 text-[11px] text-muted">{note}</div>
    </div>
  );
}

function PaymentCard({
  brand,
  title,
  subtitle,
  badge,
  action,
  dangerAction,
}: {
  brand: string;
  title: string;
  subtitle: string;
  badge?: string;
  action: string;
  dangerAction?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-hairline bg-paper p-4">
      <div className="flex min-w-0 items-center gap-4">
        <div className="flex h-8 w-12 items-center justify-center rounded-md bg-deep font-mono text-[10px] tracking-widest text-paper">
          {brand}
        </div>
        <div className="min-w-0">
          <div className="text-ui-sm font-medium tracking-tight">{title}</div>
          <div className="text-xs text-muted">{subtitle}</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {badge ? (
          <span className="hidden h-6 rounded-md bg-ink/[0.06] px-2 text-[11px] font-medium sm:inline-flex sm:items-center">
            {badge}
          </span>
        ) : null}
        <button className="h-8 px-2.5 text-xs text-muted hover:text-ink">
          {action}
        </button>
        {dangerAction ? (
          <button className="h-8 px-2.5 text-xs text-rose-700">
            {dangerAction}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const refunded = status === "Refunded";
  return (
    <span
      className={`inline-flex h-6 items-center gap-1.5 rounded-md px-2 text-[11px] font-medium ${refunded ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-700"}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${refunded ? "bg-amber-600" : "bg-emerald-600"}`}
      />
      {status}
    </span>
  );
}

function TeamMember({
  initials,
  name,
  note,
  email,
  date,
  role,
}: {
  initials: string;
  name: string;
  note?: string;
  email: string;
  date: string;
  role: string;
}) {
  return (
    <li className="flex items-center gap-4 px-6 py-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-[12px] font-semibold text-paper">
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-ui-sm font-medium tracking-tight">
          {name}{" "}
          {note ? (
            <span className="ml-1 font-mono text-[11px] text-muted">
              {note}
            </span>
          ) : null}
        </div>
        <div className="truncate text-xs text-muted">{email}</div>
      </div>
      <span className="hidden font-mono text-[11px] uppercase tracking-widest text-subtle sm:inline-block">
        {date}
      </span>
      <span className="inline-flex h-7 items-center rounded-md bg-ink/[0.06] px-2.5 text-[11px] font-medium">
        {role}
      </span>
    </li>
  );
}

function ToggleRow({
  title,
  description,
  enabled,
  onToggle,
}: {
  title: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <li className="flex items-center justify-between gap-4 px-6 py-4">
      <div className="min-w-0">
        <div className="text-ui-sm font-medium">{title}</div>
        <div className="mt-0.5 text-xs text-muted">{description}</div>
      </div>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={enabled}
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${enabled ? "bg-ink" : "bg-hairline-soft"}`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-surface shadow-sm transition-transform ${enabled ? "translate-x-[18px]" : "translate-x-0.5"}`}
        />
      </button>
    </li>
  );
}

function DangerRow({
  title,
  description,
  action,
  destructive = false,
}: {
  title: string;
  description: string;
  action: string;
  destructive?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4">
      <div className="min-w-0">
        <div className="text-ui-sm font-medium">{title}</div>
        <div className="mt-0.5 text-xs text-muted">{description}</div>
      </div>
      <button
        className={`h-9 rounded-md px-3 text-ui-sm font-medium ${destructive ? "bg-rose-700 text-paper hover:bg-rose-800" : "border border-rose-300 bg-paper text-rose-700 hover:bg-rose-50"}`}
      >
        {action}
      </button>
    </div>
  );
}

function getFirstName(label: string) {
  const trimmed = label.trim();
  if (!trimmed) return "there";
  const firstToken = trimmed.split(/\s+/)[0];
  return firstToken.includes("@") ? firstToken.split("@")[0] : firstToken;
}
