import { useServerFn } from '@tanstack/react-start'
import { useQuery } from '@tanstack/react-query'
import { ArrowDownRight, ArrowUpRight, RefreshCw, Repeat2 } from 'lucide-react'
import { getBalanceSummary } from '@/server/functions/auth'
import type { BalanceSummary } from '@/auth/types'

export const BALANCE_SUMMARY_KEY = ['episcloud-balance-summary'] as const

const updatedFormatter = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit'
})

function formatMoney(microUsd: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currency || 'USD'
  }).format(microUsd / 1_000_000)
}

export function BalanceSummaryCard({ activated }: { activated: boolean }) {
  const fetchSummary = useServerFn(getBalanceSummary)
  const query = useQuery({
    queryKey: BALANCE_SUMMARY_KEY,
    queryFn: () => fetchSummary() as Promise<BalanceSummary>,
    enabled: activated,
    staleTime: 60 * 1000
  })

  return (
    <section
      id="balance"
      className="scroll-mt-20 overflow-hidden rounded-2xl border border-hairline bg-surface"
    >
      <header className="flex items-center justify-between gap-4 border-b border-hairline px-6 py-5">
        <div>
          <h2 className="text-base font-semibold tracking-tight">AI wallet balance</h2>
          <p className="mt-0.5 text-xs text-muted">
            Shared credit pool that funds AI calls across your storefront.
          </p>
        </div>
        {activated ? (
          <button
            type="button"
            onClick={() => void query.refetch()}
            disabled={query.isFetching}
            aria-label="Refresh balance"
            className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs text-muted transition-colors hover:text-ink disabled:opacity-50"
          >
            <RefreshCw
              aria-hidden="true"
              size={13}
              className={query.isFetching ? 'animate-spin' : undefined}
            />
            Refresh
          </button>
        ) : null}
      </header>

      <div className="p-6">
        {!activated ? (
          <p className="m-0 text-center text-[13px] text-subtle">
            Activate EpisCloud in your profile to see your balance.
          </p>
        ) : query.isPending ? (
          <BalanceSkeleton />
        ) : query.isError ? (
          <div className="space-y-3 rounded-xl border border-hairline bg-paper p-5">
            <p className="m-0 text-ui-sm leading-relaxed text-danger-fg">
              {query.error instanceof Error
                ? query.error.message
                : 'Could not load your balance. Please try again.'}
            </p>
            <button
              type="button"
              onClick={() => void query.refetch()}
              className="h-8 px-2.5 text-xs text-muted transition-colors hover:text-ink"
            >
              Try again
            </button>
          </div>
        ) : (
          <BalanceContent summary={query.data} />
        )}
      </div>
    </section>
  )
}

function BalanceContent({ summary }: { summary: BalanceSummary }) {
  const { currency } = summary
  return (
    <div>
      <p className="m-0 text-[11px] font-medium uppercase tracking-wide text-subtle">
        Remaining
      </p>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="font-mono text-4xl font-semibold tracking-tight tabular-nums text-ink">
          {formatMoney(summary.remaining_micro_usd, currency)}
        </span>
        <span className="text-ui-sm text-muted">{currency}</span>
      </div>

      <dl className="mt-6 grid grid-cols-1 divide-y divide-hairline overflow-hidden rounded-xl border border-hairline bg-paper sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <Metric
          icon={ArrowUpRight}
          label="Credited total"
          value={formatMoney(summary.credited_total_micro_usd, currency)}
        />
        <Metric
          icon={ArrowDownRight}
          label="Used total"
          value={formatMoney(summary.used_total_micro_usd, currency)}
        />
        <Metric
          icon={Repeat2}
          label="Top-ups"
          value={summary.topup_count.toLocaleString()}
        />
      </dl>

      {summary.updated_at > 0 ? (
        <p className="m-0 mt-3 text-[11px] text-subtle">
          Updated {updatedFormatter.format(new Date(summary.updated_at * 1000))}
        </p>
      ) : null}
    </div>
  )
}

function Metric({
  icon: Icon,
  label,
  value
}: {
  icon: typeof ArrowUpRight
  label: string
  value: string
}) {
  return (
    <div className="flex flex-col gap-1 p-4">
      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-subtle">
        <Icon aria-hidden="true" size={13} />
        {label}
      </span>
      <span className="font-mono text-lg font-medium tabular-nums text-ink">{value}</span>
    </div>
  )
}

function BalanceSkeleton() {
  return (
    <div aria-hidden="true" className="animate-pulse">
      <div className="h-3 w-20 rounded bg-hairline" />
      <div className="mt-2 h-10 w-44 rounded bg-hairline" />
      <div className="mt-6 grid grid-cols-1 overflow-hidden rounded-xl border border-hairline sm:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <div key={index} className="flex flex-col gap-2 border-hairline p-4 sm:border-l sm:first:border-l-0">
            <div className="h-3 w-16 rounded bg-hairline" />
            <div className="h-5 w-20 rounded bg-hairline" />
          </div>
        ))}
      </div>
    </div>
  )
}
