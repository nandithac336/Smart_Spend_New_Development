import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button.jsx'
import { formatTxnDate } from '@/lib/dates.js'

const STATUS_LABELS = {
  pending: 'Waiting to sync',
  syncing: 'Synchronizing',
  conflict: 'Conflict',
  attention: 'Needs attention',
  auth_required: 'Sign in required',
}

function SyncOperationCard({ item, onDiscard, busy, timeZone }) {
  const operation = item.operation
  const transactionName = operation.payload?.merchant?.trim() ||
    operation.payload?.note?.trim() ||
    `Transaction ${operation.entityId?.slice(-6) ?? ''}`
  const canDiscard = item.status !== 'syncing'

  return (
    <li className="glass-flat min-w-0 rounded-2xl border border-border/70 p-4 sm:p-5">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold">{operation.operationType} · {transactionName}</h2>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
              item.status === 'conflict' || item.status === 'attention' || item.status === 'auth_required'
                ? 'border-warning/30 bg-warning/10 text-warning'
                : 'border-primary/25 bg-primary/10 text-primary'
            }`}>
              {STATUS_LABELS[item.status] ?? item.status}
            </span>
          </div>
          {item.error && (
            <p className="mt-2 text-sm text-muted-foreground">
              {item.error.message}
              {item.error.code && <span className="ml-1 text-xs">({item.error.code})</span>}
            </p>
          )}
          {item.error?.serverVersion && (
            <p className="mt-1 text-xs text-muted-foreground">Server version: {item.error.serverVersion}</p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            {item.retryCount > 0 ? `Retry ${item.retryCount} · ` : ''}
            Queued {formatTxnDate(item.createdAt, { timeZone }) || 'date unavailable'}
          </p>
        </div>
        {operation.entityId && (
          <Button asChild size="sm" variant="outline">
            <Link to={`/transactions?q=${encodeURIComponent(transactionName)}`}>Review transaction</Link>
          </Button>
        )}
        {canDiscard && (
          <Button disabled={busy} onClick={() => onDiscard(item)} size="sm" variant="ghost">
            Discard queued change
          </Button>
        )}
      </div>
    </li>
  )
}

export default SyncOperationCard
