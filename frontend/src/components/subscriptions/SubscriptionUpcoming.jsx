import { CalendarClock } from 'lucide-react'
import { formatINR } from '@/lib/money.js'

function formatDate(value) {
  if (!value) return 'Date unavailable'
  const date = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime())) return 'Date unavailable'
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
  }).format(date)
}

function SubscriptionUpcoming({ payments }) {
  return (
    <section aria-label="Upcoming subscription payments" className="glass-flat rounded-2xl p-4 sm:p-5">
      <header className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <CalendarClock aria-hidden="true" className="size-[18px]" />
        </span>
        <div>
          <h2 className="text-sm font-semibold">Expected in the next 30 days</h2>
          <p className="mt-1 text-xs text-muted-foreground">Estimates returned by the backend, including each subscription’s current review status.</p>
        </div>
      </header>
      {!Array.isArray(payments) ? (
        <p className="mt-4 rounded-xl bg-background/30 px-4 py-5 text-sm text-muted-foreground">Upcoming payment information is unavailable.</p>
      ) : payments.length === 0 ? (
        <p className="mt-4 rounded-xl bg-background/30 px-4 py-5 text-sm text-muted-foreground">No upcoming payments were returned for this period.</p>
      ) : (
        <ul className="mt-4 divide-y divide-border/60">
          {payments.map((payment) => (
            <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3 first:pt-0 last:pb-0" key={`${payment.subscriptionId}-${payment.expectedPaymentDate}`}>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{payment.merchantName || 'Unnamed merchant'}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatDate(payment.expectedPaymentDate)}
                  {payment.frequency ? ` · ${payment.frequency}` : ''}
                  {payment.status ? ` · ${payment.status === 'detected' ? 'detected, needs review' : payment.status}` : ''}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold tabular-nums">
                  {Number.isFinite(payment.estimatedAmountPaise) ? formatINR(payment.estimatedAmountPaise) : 'Amount unavailable'}
                </p>
                {Number.isFinite(payment.confidenceScore) && (
                  <p className="text-[11px] text-muted-foreground">Confidence {payment.confidenceScore}%</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default SubscriptionUpcoming
