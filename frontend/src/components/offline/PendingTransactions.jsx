import { Link } from 'react-router-dom'
import { formatTxnTime } from '@/lib/dates.js'
import { formatINR } from '@/lib/money.js'

const STATUS_LABELS = {
  pending: 'Pending sync',
  syncing: 'Syncing',
  conflict: 'Needs review',
  attention: 'Needs attention',
  auth_required: 'Sign in to sync',
}

function PendingTransactions({ operations, timeZone }) {
  const creates = operations.filter((item) => item.operation.operationType === 'create')
  if (creates.length === 0) return null

  return (
    <section aria-label="Transactions pending synchronization" className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold">Pending synchronization</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          These locally queued transactions are not included in confirmed totals until the server accepts them.
        </p>
      </div>
      <ul className="space-y-2">
        {creates.map((item) => {
          const transaction = item.operation.payload
          const title = transaction.merchant?.trim() || transaction.note?.trim() || 'Uncategorized transaction'
          return (
            <li className="glass-flat flex min-w-0 flex-wrap items-center gap-3 rounded-2xl border border-warning/25 p-3 sm:flex-nowrap sm:p-4" key={item.id}>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{title}</span>
                <span className="mt-0.5 block truncate text-xs capitalize text-muted-foreground">
                  {transaction.type} · {formatTxnTime(transaction.txnDate, timeZone)}
                </span>
              </span>
              <span className="text-sm font-semibold tabular">{formatINR(transaction.amount, { minimumFractionDigits: 2 })}</span>
              <span className="rounded-full border border-warning/30 bg-warning/10 px-2.5 py-1 text-xs font-medium text-warning">
                {STATUS_LABELS[item.status] ?? 'Pending sync'}
              </span>
              <Link className="text-xs font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" to="/sync">
                Details
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export default PendingTransactions
