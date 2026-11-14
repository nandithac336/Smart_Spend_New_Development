import { AlertTriangle, Pencil, ShieldCheck, Trash2 } from 'lucide-react'
import { formatINR } from '@/lib/money.js'
import { budgetDateRange } from '@/lib/budgetHelpers.js'
import { Button } from '@/components/ui/button.jsx'

const periodNames = { weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly', custom: 'Custom period' }

function BudgetCard({ budget, categories, onEdit, onArchive, archiving }) {
  const progress = budget.progress ?? {}
  const categoryId = budget.categoryId?._id ?? budget.categoryId?.id ?? budget.categoryId
  const category = budget.categoryId?.name
    ? budget.categoryId
    : categories.find((item) => (item.id ?? item._id) === categoryId)
  const used = Math.max(0, Number(progress.percentageUsed) || 0)
  const width = Math.min(100, used)
  const exceeded = Boolean(progress.isExceeded)
  const approaching = Boolean(progress.isApproachingLimit)
  const range = budgetDateRange(budget)
  const dateLabel = range.start === range.end ? range.start : `${range.start} – ${range.end}`

  return (
    <article className="glass-flat min-w-0 rounded-2xl p-4 sm:p-5">
      <header className="flex items-start gap-3">
        <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl text-lg ${exceeded ? 'bg-destructive/10 text-destructive' : approaching ? 'bg-amber-400/10 text-amber-300' : 'bg-primary/10 text-primary'}`}>
          {category?.icon || '◈'}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-semibold">{budget.name}</h2>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {category?.name || (categoryId ? 'Expense category' : 'All expense categories')} · {periodNames[budget.period]} · {dateLabel}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button aria-label={`Edit ${budget.name}`} onClick={() => onEdit(budget)} size="icon-sm" variant="ghost"><Pencil aria-hidden="true" /></Button>
          <Button aria-label={`Archive ${budget.name}`} disabled={archiving} onClick={() => onArchive(budget)} size="icon-sm" variant="ghost"><Trash2 aria-hidden="true" /></Button>
        </div>
      </header>
      <div className="mt-5 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">Spent</p>
          <p className={`mt-1 text-xl font-bold tabular-nums ${exceeded ? 'text-destructive' : ''}`}>
            {formatINR(progress.actualSpending ?? 0)}
          </p>
        </div>
        <p className="text-right text-xs text-muted-foreground">
          of <span className="font-semibold text-foreground">{formatINR(progress.budgetAmount ?? budget.amount)}</span>
        </p>
      </div>
      <div
        aria-label={`${Math.round(used)}% of budget used`}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={Math.min(100, Math.round(used))}
        className="mt-3 h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
      >
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${exceeded ? 'bg-destructive' : approaching ? 'bg-amber-400' : 'bg-gradient-to-r from-primary to-sky-400'}`}
          style={{ width: `${width}%` }}
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
        {exceeded ? (
          <span className="inline-flex items-center gap-1.5 font-medium text-destructive"><AlertTriangle aria-hidden="true" className="size-3.5" />Over budget by {formatINR(Math.abs(progress.remainingAmount ?? 0))}</span>
        ) : approaching ? (
          <span className="inline-flex items-center gap-1.5 font-medium text-amber-300"><AlertTriangle aria-hidden="true" className="size-3.5" />Approaching limit</span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-muted-foreground"><ShieldCheck aria-hidden="true" className="size-3.5 text-emerald-300" />On track</span>
        )}
        <span className={progress.remainingAmount < 0 ? 'font-semibold text-destructive' : 'text-muted-foreground'}>
          {progress.remainingAmount < 0 ? 'Remaining' : 'Left'} {formatINR(progress.remainingAmount ?? 0)}
        </span>
      </div>
    </article>
  )
}

export default BudgetCard
