import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ArrowUpRight, Check, CircleAlert, LoaderCircle, RotateCcw, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button.jsx'
import { getTransaction } from '@/services/transactionApi.js'
import { formatTxnDate } from '@/lib/dates.js'
import { formatINR, fromPaise } from '@/lib/money.js'
import { dateOnlyRangeToIso } from '@/lib/transactionDates.js'

const severityStyles = {
  low: 'border-sky-400/20 bg-sky-400/10 text-sky-200',
  medium: 'border-amber-400/20 bg-amber-400/10 text-amber-200',
  high: 'border-orange-400/25 bg-orange-400/10 text-orange-200',
  critical: 'border-rose-400/25 bg-rose-400/10 text-rose-200',
}

const typeNames = {
  large_transaction: 'Large transaction',
  duplicate_exact: 'Possible exact duplicate',
  duplicate_possible: 'Possible duplicate',
  new_merchant: 'New merchant',
  unusual_merchant_amount: 'Unusual merchant amount',
  merchant_spending_increase: 'Merchant spending increase',
  high_frequency: 'High transaction frequency',
  category_spending_increase: 'Category spending increase',
  category_amount_anomaly: 'Unusual category amount',
  wallet_anomaly: 'Unusual wallet amount',
}

function objectId(value) {
  return String(value?._id ?? value?.id ?? value ?? '')
}

function transactionSearch(transaction, timeZone) {
  const params = new URLSearchParams()
  if (transaction.type) params.set('type', transaction.type)
  const merchant = transaction.merchant?.trim()
  if (merchant) params.set('q', merchant)
  const walletId = objectId(transaction.walletId)
  const categoryId = objectId(transaction.categoryId)
  if (walletId) params.set('walletId', walletId)
  if (categoryId) params.set('categoryId', categoryId)
  if (Number.isSafeInteger(transaction.amount)) {
    const rupees = fromPaise(transaction.amount).toFixed(2)
    params.set('minAmount', rupees)
    params.set('maxAmount', rupees)
  }
  if (transaction.txnDate) {
    const date = new Date(transaction.txnDate)
    if (Number.isFinite(date.getTime())) {
      const day = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
      const range = dateOnlyRangeToIso(day, day, timeZone)
      if (range.from) params.set('from', range.from)
      if (range.to) params.set('to', range.to)
    }
  }
  return `/transactions?${params.toString()}`
}

function AnomalyCard({ anomaly, timeZone, busy, onUpdateStatus }) {
  const transaction = anomaly.transactionId && typeof anomaly.transactionId === 'object'
    ? anomaly.transactionId
    : null
  const transactionId = objectId(transaction ?? anomaly.transactionId)
  const transactionQuery = useQuery({
    queryKey: ['transactions', 'anomaly', transactionId],
    queryFn: () => getTransaction(transactionId),
    enabled: Boolean(transactionId && transaction && (!transaction.walletId?.name || !transaction.categoryId?.name)),
  })
  const fullTransaction = transactionQuery.data ?? transaction
  const status = anomaly.status
  const canMarkReviewed = ['new', 'dismissed', 'resolved'].includes(status)
  const canDismiss = ['new', 'reviewed'].includes(status)
  const severityClass = severityStyles[anomaly.severity] ?? severityStyles.low

  return (
    <article className="glass-flat space-y-4 rounded-2xl p-4 sm:p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl border ${severityClass}`}>
            <AlertTriangle aria-hidden="true" className="size-4" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">{typeNames[anomaly.anomalyType] ?? anomaly.anomalyType}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {anomaly.detectedAt ? formatTxnDate(anomaly.detectedAt, { timeZone }) : ''}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${severityClass}`}>{anomaly.severity}</span>
          <span className="rounded-full border border-border/70 bg-background/40 px-2.5 py-1 text-xs capitalize text-muted-foreground">{status}</span>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1.3fr)_minmax(12rem,0.7fr)]">
        <div className="space-y-2 rounded-xl border border-border/70 bg-background/35 p-3">
          {fullTransaction ? (
            <>
              <p className="truncate text-sm font-semibold">{fullTransaction.merchant || fullTransaction.note || 'Unlabeled transaction'}</p>
              <p className="text-sm font-semibold text-foreground">{formatINR(fullTransaction.amount)}</p>
              <p className="text-xs text-muted-foreground">
                {fullTransaction.type || 'Transaction'}
                {fullTransaction.txnDate ? ` · ${formatTxnDate(fullTransaction.txnDate, { timeZone })}` : ''}
                {fullTransaction.categoryId?.name ? ` · ${fullTransaction.categoryId.name}` : ''}
                {fullTransaction.walletId?.name ? ` · ${fullTransaction.walletId.name}` : ''}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">The original transaction is no longer available.</p>
          )}
          {transactionQuery.isError && <p className="text-xs text-muted-foreground" role="status">Some transaction details couldn’t be loaded.</p>}
          {transactionId && fullTransaction && (
            <Link className="inline-flex items-center gap-1 pt-1 text-xs font-semibold text-primary hover:underline" to={transactionSearch(fullTransaction, timeZone)}>
              Find this transaction <ArrowUpRight aria-hidden="true" className="size-3.5" />
            </Link>
          )}
        </div>
        <div className="flex flex-col justify-center rounded-xl border border-border/70 p-3">
          <p className="text-xs text-muted-foreground">Anomaly score</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{anomaly.score}<span className="text-sm font-medium text-muted-foreground">/100</span></p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">Backend score for unusual activity; it is not a fraud probability.</p>
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-border/60 bg-background/25 p-3">
        <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 space-y-1">
          <p className="text-sm leading-relaxed">{anomaly.explanation}</p>
          {anomaly.suggestedAction && <p className="text-xs leading-relaxed text-muted-foreground">{anomaly.suggestedAction}</p>}
        </div>
      </div>

      <footer className="flex flex-wrap gap-2 border-t border-border/60 pt-3">
        {canMarkReviewed && (
          <Button disabled={busy} onClick={() => onUpdateStatus(anomaly, 'reviewed')} size="sm" type="button" variant="outline">
            {busy ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : status === 'new' ? <Check aria-hidden="true" /> : <RotateCcw aria-hidden="true" />}
            {status === 'new' ? 'Mark reviewed' : 'Reopen for review'}
          </Button>
        )}
        {canDismiss && (
          <Button disabled={busy} onClick={() => onUpdateStatus(anomaly, 'dismissed')} size="sm" type="button" variant="outline">
            <X aria-hidden="true" />Dismiss
          </Button>
        )}
      </footer>
    </article>
  )
}

export default AnomalyCard
