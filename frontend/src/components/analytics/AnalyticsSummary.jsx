import { ArrowDownLeft, ArrowUpRight, CircleDollarSign, Activity } from 'lucide-react'
import Amount from '@/components/common/Amount.jsx'

const metrics = [
  { key: 'income', label: 'Total income', icon: ArrowDownLeft, type: 'income', tone: 'text-income bg-income/10' },
  { key: 'expense', label: 'Total expenses', icon: ArrowUpRight, type: 'expense', tone: 'text-expense bg-expense/10' },
  { key: 'netSavings', label: 'Net savings', icon: CircleDollarSign, type: 'neutral', tone: 'text-primary bg-primary/10' },
]

function AnalyticsSummary({ summary }) {
  return (
    <section aria-label="Financial summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map(({ key, label, icon: Icon, type, tone }) => (
        <article className="glass-flat rounded-2xl p-4 sm:p-5" key={key}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <span className={`flex size-9 items-center justify-center rounded-xl ${tone}`}>
              <Icon aria-hidden="true" className="size-[18px]" />
            </span>
          </div>
          <p className="mt-4 text-xl font-bold tracking-tight sm:text-2xl">
            <Amount value={summary[key] ?? 0} type={type} />
          </p>
        </article>
      ))}
      <article className="glass-flat rounded-2xl p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium text-muted-foreground">Savings rate</p>
          <span className="flex size-9 items-center justify-center rounded-xl bg-accent/70 text-primary">
            <Activity aria-hidden="true" className="size-[18px]" />
          </span>
        </div>
        <p className="mt-4 text-xl font-bold tracking-tight sm:text-2xl">{summary.savingsRate ?? 0}%</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Across {summary.transactionCount ?? 0} confirmed transactions
        </p>
      </article>
    </section>
  )
}

export default AnalyticsSummary
