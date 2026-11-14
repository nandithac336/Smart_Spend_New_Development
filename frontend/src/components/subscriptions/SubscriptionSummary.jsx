import { CalendarClock, CircleCheck, CircleHelp } from 'lucide-react'
import { formatINR } from '@/lib/money.js'

function SubscriptionSummary({ summary, isLoading }) {
  const confirmedCost = Number.isFinite(summary?.estimatedMonthlyCostPaise)
    ? formatINR(summary.estimatedMonthlyCostPaise)
    : 'unavailable'
  const detectedCost = Number.isFinite(summary?.detected?.monthlyCostPaise)
    ? formatINR(summary.detected.monthlyCostPaise)
    : 'unavailable'
  const cards = [
    {
      label: 'Confirmed subscriptions',
      value: isLoading ? '—' : Number.isFinite(summary?.activeConfirmedSubscriptions) ? summary.activeConfirmedSubscriptions : '—',
      detail: isLoading ? 'Loading summary' : `Estimated monthly cost ${confirmedCost}`,
      icon: CircleCheck,
      tone: 'text-emerald-300 bg-emerald-400/10',
    },
    {
      label: 'Detected · needs review',
      value: isLoading ? '—' : Number.isFinite(summary?.detectedSubscriptionCount) ? summary.detectedSubscriptionCount : '—',
      detail: isLoading ? 'Loading summary' : `Potential monthly cost ${detectedCost}`,
      icon: CircleHelp,
      tone: 'text-amber-300 bg-amber-400/10',
    },
    {
      label: 'Upcoming in 30 days',
      value: isLoading ? '—' : Array.isArray(summary?.upcomingPayments) ? summary.upcomingPayments.length : '—',
      detail: 'Backend-reported expected payment dates',
      icon: CalendarClock,
      tone: 'text-primary bg-primary/10',
    },
  ]

  return (
    <section aria-label="Subscription summary" className="grid gap-3 sm:grid-cols-3">
      {cards.map(({ label, value, detail, icon: Icon, tone }) => (
        <article className="glass-flat flex min-w-0 items-center gap-3 rounded-2xl p-4" key={label}>
          <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${tone}`}>
            <Icon aria-hidden="true" className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-lg font-semibold">{value}</p>
            <p className="truncate text-[11px] text-muted-foreground">{detail}</p>
          </div>
        </article>
      ))}
    </section>
  )
}

export default SubscriptionSummary
