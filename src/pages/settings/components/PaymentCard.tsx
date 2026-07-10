export function PaymentCard({
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
