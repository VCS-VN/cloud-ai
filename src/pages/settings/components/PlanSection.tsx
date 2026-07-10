import { Button } from "@/components/ui/button";

export function PlanSection() {
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
