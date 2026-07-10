export function UsageSection() {
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
