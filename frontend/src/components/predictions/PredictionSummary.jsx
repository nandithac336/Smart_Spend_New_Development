import { CalendarClock, ChartNoAxesCombined, CircleDollarSign, History } from 'lucide-react'
import Amount from '@/components/common/Amount.jsx'

function SummaryCard({ label, value, displayValue, icon: Icon, detail, isEstimate = false }) {
  return (
    <article className="glass-flat min-w-0 rounded-2xl p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon aria-hidden="true" className="size-[18px]" />
        </span>
      </div>
      <p className="mt-4 text-xl font-bold tracking-tight sm:text-2xl">
        {displayValue !== undefined
          ? <span>{displayValue}</span>
          : value === null
            ? <span className="text-sm text-muted-foreground">Not enough history</span>
            : <Amount value={value} />}
      </p>
      {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
      {isEstimate && <span className="sr-only">Estimated value</span>}
    </article>
  )
}

function PredictionSummary({ prediction, monthLabel }) {
  const forecast = prediction?.status === 'ok' ? prediction.predictedAmountPaise : null
  const actual = prediction?.actualMonthToDatePaise
  const recurring = prediction?.knownRecurringPaise
  const sampleSize = prediction?.confidence?.historicalSampleSize ?? 0

  return (
    <section aria-label={`${monthLabel} expense forecast summary`} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <SummaryCard
        detail="Estimate, not a guaranteed future expense"
        icon={CircleDollarSign}
        isEstimate
        label="Expected total"
        value={forecast}
      />
      <SummaryCard
        detail="Confirmed expenses recorded so far"
        icon={History}
        label="Spent so far"
        value={actual ?? 0}
      />
      <SummaryCard
        detail="Active recurring schedules and confirmed subscriptions"
        icon={CalendarClock}
        label="Known scheduled"
        value={recurring ?? 0}
      />
      <SummaryCard
        detail={`${sampleSize} active historical month${sampleSize === 1 ? '' : 's'} available`}
        displayValue={`${sampleSize} month${sampleSize === 1 ? '' : 's'}`}
        icon={ChartNoAxesCombined}
        label="History coverage"
      />
    </section>
  )
}

export default PredictionSummary
