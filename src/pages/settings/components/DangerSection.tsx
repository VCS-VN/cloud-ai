export function DangerSection() {
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
