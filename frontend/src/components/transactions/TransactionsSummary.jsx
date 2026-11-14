import { useQuery } from '@tanstack/react-query'
import { ArrowDownLeft, ArrowUpRight, Scale } from 'lucide-react'
import { formatINR } from '@/lib/money.js'
import { getTransactionSummary } from '@/services/analyticsApi.js'
import { transactionSummaryParams } from './transactionSummary.js'

const cards = [
  { key: 'income', label: 'Total income', icon: ArrowDownLeft, tone: 'text-emerald-300' },
  { key: 'expense', label: 'Total expenses', icon: ArrowUpRight, tone: 'text-rose-300' },
  { key: 'netSavings', label: 'Net balance', icon: Scale, tone: 'text-sky-300' },
]

function TransactionsSummary({ searchParams, timeZone }) {
  const { filters, label } = transactionSummaryParams(searchParams, timeZone)
  const summaryQuery = useQuery({
    queryKey: ['transactions', 'summary', filters],
    queryFn: () => getTransactionSummary(filters),
    enabled: Boolean(filters),
  })

  return (
    <section aria-label="Transaction summary" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Financial summary</h2>
          <p className="text-xs text-muted-foreground">{label} · actual income and expense totals</p>
        </div>
        <p className="text-right text-xs text-muted-foreground">
          Search, amount and type filters affect the list only.
        </p>
      </div>
      {!filters ? (
        <div className="glass-flat rounded-2xl p-4 text-sm text-muted-foreground">
          Select both dates to view a summary for this range.
        </div>
      ) : summaryQuery.isPending ? (
        <div aria-busy="true" className="grid gap-3 sm:grid-cols-3">
          {cards.map(({ key }) => <div className="glass-flat h-24 animate-pulse rounded-2xl" key={key} />)}
        </div>
      ) : summaryQuery.isError ? (
        <div className="glass-flat rounded-2xl p-4 text-sm text-destructive" role="alert">
          Couldn’t load the financial summary. The transaction list is still available.
          <button className="ml-2 font-semibold underline" onClick={() => summaryQuery.refetch()} type="button">Retry</button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          {cards.map(({ key, label: title, icon: Icon, tone }) => (
            <article className="glass-flat flex min-w-0 items-center gap-3 rounded-2xl p-4" key={key}>
              <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent/70 ${tone}`}>
                <Icon aria-hidden="true" className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{title}</p>
                <p className="mt-1 truncate text-lg font-semibold tabular-nums">{formatINR(summaryQuery.data?.[key] ?? 0)}</p>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

export default TransactionsSummary
