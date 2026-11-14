import { formatINR } from '@/lib/money.js'
import { formatTxnDate } from '@/lib/dates.js'
import EmptyState from '@/components/common/EmptyState.jsx'
import ErrorState from '@/components/common/ErrorState.jsx'
import { Button } from '@/components/ui/button.jsx'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog.jsx'

function SubscriptionHistoryDialog({ subscription, query, timeZone, page, onPageChange, onClose }) {
  const payments = query.data?.payments ?? []

  return (
    <Dialog onOpenChange={(open) => { if (!open) onClose() }} open={Boolean(subscription)}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Observed payment history</DialogTitle>
          <DialogDescription>
            Payments associated with {subscription?.merchantName || 'this subscription'} in your transaction history. Reviewing this list does not create or alter transactions.
          </DialogDescription>
        </DialogHeader>
        {query.isPending ? (
          <div aria-busy="true" aria-label="Loading subscription history" className="space-y-2">
            {Array.from({ length: 3 }, (_, index) => <div className="glass-flat h-16 animate-pulse rounded-xl" key={index} />)}
          </div>
        ) : query.isError ? (
          <ErrorState onRetry={() => query.refetch()} title="Could not load payment history" />
        ) : payments.length === 0 ? (
          <EmptyState description="No supporting payments were returned by the backend." title="No payment history available" />
        ) : (
          <>
            <ul aria-label="Observed subscription payments" className="space-y-2">
              {payments.map((payment, index) => (
                <li className="glass-flat flex min-w-0 items-center gap-3 rounded-xl p-3" key={payment.transactionId ?? `${payment.paidAt}-${index}`}>
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">₹</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{formatTxnDate(payment.paidAt, { timeZone })}</span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {payment.transactionId ? `Transaction ${payment.transactionId}` : 'Transaction reference unavailable'}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">
                    {Number.isFinite(payment.amountPaise) ? formatINR(payment.amountPaise) : 'Amount unavailable'}
                  </span>
                </li>
              ))}
            </ul>
            {query.data?.historyTruncated && (
              <p className="text-xs text-amber-300">The backend indicates that the available supporting history is truncated.</p>
            )}
            {query.data?.pagination?.pages > 1 && (
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">Page {query.data.pagination.page} of {query.data.pagination.pages}</p>
                <div className="flex gap-2">
                  <Button disabled={page <= 1} onClick={() => onPageChange(page - 1)} size="sm" variant="outline">Previous</Button>
                  <Button disabled={page >= query.data.pagination.pages} onClick={() => onPageChange(page + 1)} size="sm" variant="outline">Next</Button>
                </div>
              </div>
            )}
          </>
        )}
        <div className="flex justify-end border-t pt-3">
          <Button onClick={onClose} variant="outline">Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default SubscriptionHistoryDialog
