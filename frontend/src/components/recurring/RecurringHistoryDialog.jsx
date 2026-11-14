import { formatINR } from '@/lib/money.js'
import { formatTxnDate } from '@/lib/dates.js'
import EmptyState from '@/components/common/EmptyState.jsx'
import ErrorState from '@/components/common/ErrorState.jsx'
import { Button } from '@/components/ui/button.jsx'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.jsx'

function RecurringHistoryDialog({ schedule, query, timeZone, onClose }) {
  const transactions = query.data ?? []

  return (
    <Dialog onOpenChange={(open) => { if (!open) onClose() }} open>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Created transactions</DialogTitle>
          <DialogDescription>
            Confirmed transactions already generated from “{schedule.name}”. The schedule itself is not a transaction.
          </DialogDescription>
        </DialogHeader>
        {query.isPending ? (
          <div aria-busy="true" aria-label="Loading generated transactions" className="space-y-2">
            {Array.from({ length: 3 }, (_, index) => <div className="glass-flat h-16 animate-pulse rounded-xl" key={index} />)}
          </div>
        ) : query.isError ? (
          <ErrorState onRetry={() => query.refetch()} title="Could not load generated transactions" />
        ) : transactions.length === 0 ? (
          <EmptyState description="No transactions have been generated from this schedule yet." title="Nothing generated yet" />
        ) : (
          <ul aria-label="Generated transaction history" className="space-y-2">
            {transactions.map((transaction) => {
              const id = transaction.id ?? transaction._id
              return (
                <li className="glass-flat flex min-w-0 items-center gap-3 rounded-xl p-3" key={id}>
                  <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg text-xs font-semibold ${transaction.type === 'income' ? 'bg-emerald-400/10 text-emerald-300' : 'bg-primary/10 text-primary'}`}>
                    {transaction.type === 'income' ? 'IN' : 'EX'}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{transaction.merchant || transaction.note || schedule.name}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{formatTxnDate(transaction.txnDate, { timeZone })}{transaction.deletedAt ? ' · in trash' : ''}</span>
                  </span>
                  <span className={`shrink-0 text-sm font-semibold tabular-nums ${transaction.type === 'income' ? 'text-emerald-300' : ''}`}>
                    {transaction.type === 'expense' ? '−' : '+'}{formatINR(transaction.amount)}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
        <div className="flex justify-end border-t pt-3">
          <Button onClick={onClose} variant="outline">Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default RecurringHistoryDialog
