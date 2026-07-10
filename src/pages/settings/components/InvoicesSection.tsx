export function InvoicesSection() {
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
