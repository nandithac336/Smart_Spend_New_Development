import { CalendarRange, CircleCheck, Goal, WalletCards } from 'lucide-react'
import Amount from '@/components/common/Amount.jsx'
import { useMotionDisabled } from '@/hooks/useMotionDisabled.js'

function InsightPanel({ title, icon: Icon, children, description }) {
  return (
    <section className="glass-flat min-w-0 rounded-2xl p-4 sm:p-5">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon aria-hidden="true" className="size-[18px]" />
        </span>
        <div>
          <h2 className="text-sm font-semibold sm:text-base">{title}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </section>
  )
}

function ProgressBar({ value, label }) {
  const motionDisabled = useMotionDisabled()
  const width = Math.min(100, Math.max(0, Number(value) || 0))
  return (
    <div
      aria-label={label}
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={width}
      className="h-2 overflow-hidden rounded-full bg-muted"
      role="progressbar"
    >
      <div className={`h-full rounded-full bg-gradient-to-r from-primary to-sky-400 ${motionDisabled ? '' : 'transition-[width] duration-300'}`} style={{ width: `${width}%` }} />
    </div>
  )
}

function BudgetInsight({ data }) {
  const budgets = data.budgets?.budgets ?? []
  return (
    <InsightPanel description="Current active budgets and their own budget-cycle totals." icon={WalletCards} title="Budget performance">
      {budgets.length ? (
        <div className="space-y-4">
          {budgets.slice(0, 5).map((budget) => {
            const progress = budget.progress ?? {}
            const percentage = progress.percentageUsed ?? 0
            const state = progress.isExceeded ? 'Over limit' : progress.isApproachingLimit ? 'Near limit' : 'On track'
            return (
              <article key={budget._id ?? budget.id ?? budget.name}>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{budget.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{state}</p>
                  </div>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{percentage}%</span>
                </div>
                <ProgressBar label={`${budget.name} budget used`} value={percentage} />
                <div className="mt-2 flex justify-between gap-2 text-xs text-muted-foreground">
                  <Amount className="text-xs font-medium" value={progress.actualSpending ?? 0} />
                  <span>of <Amount className="text-xs font-medium" value={progress.budgetAmount ?? budget.amount ?? 0} /></span>
                </div>
              </article>
            )
          })}
        </div>
      ) : <p className="rounded-xl bg-background/35 px-3 py-4 text-sm text-muted-foreground">No active budgets to compare.</p>}
    </InsightPanel>
  )
}

function GoalInsight({ data }) {
  const goals = data.savings?.goals ?? []
  const summary = data.savings?.summary ?? {}
  return (
    <InsightPanel description="Saved amounts and progress from your active and completed goals." icon={Goal} title="Savings goals">
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-muted-foreground">Saved so far</p>
          <p className="mt-1 text-sm font-semibold"><Amount value={summary.totalSavedAmount ?? 0} /></p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Overall progress</p>
          <p className="mt-1 text-sm font-semibold">{summary.percentageComplete ?? 0}%</p>
        </div>
      </div>
      {goals.length ? (
        <div className="space-y-4">
          {goals.slice(0, 4).map((goal) => (
            <article key={goal._id ?? goal.id ?? goal.name}>
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="truncate text-sm font-medium">{goal.name}</p>
                <span className="shrink-0 text-xs text-muted-foreground">{goal.progress?.percentageComplete ?? 0}%</span>
              </div>
              <ProgressBar label={`${goal.name} savings goal progress`} value={goal.progress?.percentageComplete} />
              <div className="mt-2 flex justify-between gap-2 text-xs text-muted-foreground">
                <Amount className="text-xs font-medium" value={goal.progress?.savedAmount ?? goal.savedAmount ?? 0} />
                <span>of <Amount className="text-xs font-medium" value={goal.progress?.targetAmount ?? goal.targetAmount ?? 0} /></span>
              </div>
            </article>
          ))}
        </div>
      ) : <p className="rounded-xl bg-background/35 px-3 py-4 text-sm text-muted-foreground">No savings goals yet.</p>}
    </InsightPanel>
  )
}

function dateLabel(value, timeZone) {
  if (!value) return 'Date unavailable'
  return new Intl.DateTimeFormat('en-IN', {
    timeZone,
    day: 'numeric',
    month: 'short',
  }).format(new Date(`${value}T12:00:00.000Z`))
}

function SubscriptionInsight({ data, timeZone }) {
  const subscriptions = data.subscriptions ?? {}
  const upcoming = subscriptions.upcomingPayments ?? []
  return (
    <InsightPanel description="Server-estimated subscription costs and renewals; not a recurring transaction schedule." icon={CalendarRange} title="Subscription outlook">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-background/35 p-3">
          <p className="text-xs text-muted-foreground">Estimated monthly cost</p>
          <p className="mt-1 text-sm font-semibold"><Amount value={subscriptions.estimatedMonthlyCostPaise ?? 0} /></p>
        </div>
        <div className="rounded-xl bg-background/35 p-3">
          <p className="text-xs text-muted-foreground">Confirmed subscriptions</p>
          <p className="mt-1 text-sm font-semibold">{subscriptions.activeConfirmedSubscriptions ?? 0}</p>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-muted-foreground">Awaiting confirmation</p>
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
          {subscriptions.detectedSubscriptionCount ?? 0}
        </span>
      </div>
      <div className="mt-4 border-t border-border/70 pt-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground">Upcoming in the next {subscriptions.upcomingHorizonDays ?? 30} days</p>
        {upcoming.length ? (
          <ul className="space-y-2">
            {upcoming.slice(0, 3).map((payment) => (
              <li className="flex items-center justify-between gap-3 text-sm" key={payment.subscriptionId}>
                <span className="min-w-0 truncate">{payment.merchantName}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{dateLabel(payment.expectedPaymentDate, timeZone)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No estimated renewals in this horizon.</p>
        )}
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <CircleCheck aria-hidden="true" className="size-3.5" />
        Subscription amounts are estimates, not completed payments.
      </p>
    </InsightPanel>
  )
}

function AnalyticsInsights({ data, timeZone }) {
  return (
    <section aria-label="Planning insights" className="grid gap-4 xl:grid-cols-3">
      <BudgetInsight data={data} />
      <GoalInsight data={data} />
      <SubscriptionInsight data={data} timeZone={timeZone} />
    </section>
  )
}

export default AnalyticsInsights
