import { CalendarClock, Check, Clock3, Pencil, ReceiptText, X } from 'lucide-react'
import { formatINR } from '@/lib/money.js'
import { Button } from '@/components/ui/button.jsx'

const frequencyNames = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  annual: 'Annual',
}

const statusNames = {
  detected: 'Detected · needs review',
  confirmed: 'Confirmed',
  dismissed: 'Dismissed',
  cancelled: 'Cancelled',
}

function formatDate(value, timeZone) {
  if (!value) return 'Not available'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not available'
  return new Intl.DateTimeFormat('en-IN', {
    timeZone,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function SubscriptionCard({
  subscription,
  categoryName,
  timeZone,
  busy,
  onEdit,
  onHistory,
  onConfirm,
  onDismiss,
  onCancel,
}) {
  const editable = ['detected', 'confirmed'].includes(subscription.status)
  const evidence = subscription.detectionEvidence

  return (
    <article className="glass-flat min-w-0 rounded-2xl p-4 sm:p-5">
      <header className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <CalendarClock aria-hidden="true" className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate font-semibold">{subscription.merchantName || 'Unnamed merchant'}</h2>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${subscription.status === 'confirmed' ? 'bg-emerald-400/10 text-emerald-300' : subscription.status === 'detected' ? 'bg-amber-400/10 text-amber-300' : 'bg-muted text-muted-foreground'}`}>
              {statusNames[subscription.status] ?? 'Status unavailable'}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {frequencyNames[subscription.frequency] || 'Frequency unavailable'}
            {categoryName
              ? ` · ${categoryName}`
              : ` · ${subscription.categoryId ? 'Category unavailable' : 'Uncategorized'}`}
          </p>
        </div>
        {editable && (
          <Button aria-label={`Edit ${subscription.merchantName}`} disabled={busy} onClick={() => onEdit(subscription)} size="icon-sm" variant="ghost">
            <Pencil aria-hidden="true" />
          </Button>
        )}
      </header>

      <div className="mt-5 flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">Average payment</span>
        <span className="text-xl font-bold tabular-nums">
          {Number.isFinite(subscription.averageAmountPaise) ? formatINR(subscription.averageAmountPaise) : 'Amount unavailable'}
        </span>
      </div>

      <div className="mt-3 space-y-2 border-t border-border/70 pt-3 text-xs">
        <p className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <Clock3 aria-hidden="true" className="size-3.5" />
            Last observed
          </span>
          <span className="font-medium">{formatDate(subscription.lastPaymentDate, timeZone)}</span>
        </p>
        <p className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Next expected</span>
          <span className="font-medium">{formatDate(subscription.estimatedNextPaymentDate, timeZone)}</span>
        </p>
        <p className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Detection confidence</span>
          <span className="font-medium capitalize">
            {subscription.confidenceLevel || 'Not provided'}
            {Number.isFinite(subscription.confidenceScore) ? ` · ${subscription.confidenceScore}%` : ''}
          </span>
        </p>
        {evidence && (
          <div className="rounded-xl bg-background/35 p-3">
            <p className="font-medium text-foreground">Supporting evidence</p>
            <p className="mt-1 text-muted-foreground">
              {Number.isFinite(evidence.transactionCount) ? `${evidence.transactionCount} matching payments` : 'Payment count unavailable'}
              {Number.isFinite(evidence.intervalConsistencyPercent) ? ` · ${evidence.intervalConsistencyPercent}% interval consistency` : ''}
              {Number.isFinite(evidence.amountVariationPercent) ? ` · ${evidence.amountVariationPercent}% amount variation` : ''}
            </p>
            {evidence.historyTruncated && (
              <p className="mt-1 text-amber-300">Detection used truncated transaction history.</p>
            )}
          </div>
        )}
      </div>

      <footer className="mt-4 flex flex-wrap gap-2 border-t border-border/70 pt-3">
        <Button className="flex-1" disabled={busy} onClick={() => onHistory(subscription)} size="sm" variant="outline">
          <ReceiptText aria-hidden="true" /> Payment history
        </Button>
        {subscription.status === 'detected' && (
          <>
            <Button aria-label={`Confirm ${subscription.merchantName}`} disabled={busy} onClick={() => onConfirm(subscription)} size="icon" variant="outline">
              <Check aria-hidden="true" />
            </Button>
            <Button aria-label={`Dismiss ${subscription.merchantName}`} disabled={busy} onClick={() => onDismiss(subscription)} size="icon" variant="ghost">
              <X aria-hidden="true" />
            </Button>
          </>
        )}
        {subscription.status === 'confirmed' && (
          <Button aria-label={`Cancel ${subscription.merchantName}`} disabled={busy} onClick={() => onCancel(subscription)} size="icon" variant="ghost">
            <X aria-hidden="true" />
          </Button>
        )}
      </footer>
    </article>
  )
}

export default SubscriptionCard
