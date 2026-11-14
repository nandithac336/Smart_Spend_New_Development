import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, m } from 'motion/react'
import { useMotionDisabled } from '@/hooks/useMotionDisabled.js'
import { useMediaQuery } from '@/hooks/useMediaQuery.js'
import { formatTxnDate, groupByDay } from '@/lib/dates.js'
import { formatINR } from '@/lib/money.js'
import EmptyState from '@/components/common/EmptyState.jsx'
import ErrorState from '@/components/common/ErrorState.jsx'
import TransactionItem from '@/components/transactions/TransactionItem.jsx'
import { Button } from '@/components/ui/button.jsx'

function TransactionList({
  transactions,
  highlightKey,
  timeZone,
  isLoading,
  isError,
  onRetry,
  hasFilters,
  onClearFilters,
  onEdit,
  onDelete,
  hasNextPage,
  isFetchingNextPage,
  isFetchNextPageError,
  onLoadMore,
  pendingSyncByEntityId,
}) {
  const previousTransactions = useRef(null)
  const [highlightedIds, setHighlightedIds] = useState(() => new Set())
  const isPhone = useMediaQuery('(max-width: 639px)')
  const motionDisabled = useMotionDisabled()
  const highlightTimeout = useRef(null)

  useEffect(() => {
    return () => window.clearTimeout(highlightTimeout.current)
  }, [])

  useEffect(() => {
    if (isLoading || isError) return

    const current = new Map(transactions.map((transaction) => {
      const id = transaction._id ?? transaction.id
      return [id, JSON.stringify([
        transaction.type,
        transaction.amount,
        transaction.merchant,
        transaction.note,
        transaction.tags,
        transaction.paymentMethod,
        transaction.walletId?._id ?? transaction.walletId?.id ?? transaction.walletId,
        transaction.categoryId?._id ?? transaction.categoryId?.id ?? transaction.categoryId,
        transaction.txnDate,
      ])]
    }))
    const previous = previousTransactions.current
    previousTransactions.current = { filterKey: highlightKey, transactions: current }
    if (!previous || previous.filterKey !== highlightKey) return

    const changedIds = [...current].filter(([id, signature]) => previous.transactions.get(id) !== signature).map(([id]) => id)
    if (changedIds.length === 0) return

    setHighlightedIds(new Set(changedIds))
    window.clearTimeout(highlightTimeout.current)
    highlightTimeout.current = window.setTimeout(() => {
      setHighlightedIds(new Set())
    }, 1000)
  }, [highlightKey, isError, isLoading, transactions])

  if (isLoading) {
    return (
      <div aria-busy="true" className="space-y-3">
        {Array.from({ length: 5 }, (_, index) => (
          <div className="glass-flat h-[4.5rem] animate-pulse rounded-2xl" key={index} />
        ))}
      </div>
    )
  }

  if (isError) {
    return <ErrorState description="We couldn’t load your transactions." onRetry={onRetry} title="Couldn’t load transactions" />
  }

  if (transactions.length === 0) {
    return (
      <EmptyState
        action={hasFilters ? <Button onClick={onClearFilters} variant="outline">Clear filters</Button> : null}
        description={hasFilters ? 'Try changing or clearing your filters.' : 'Your spending and income activity will show up here.'}
        title={hasFilters ? 'No matching transactions' : 'No transactions yet'}
      />
    )
  }

  const groups = groupByDay(transactions, { timeZone })

  return (
    <div className="space-y-6">
      <AnimatePresence initial={false}>
        {groups.map((group) => (
          <m.section
            aria-labelledby={`transaction-day-${group.date}`}
            className="overflow-hidden"
            key={group.date}
            layout
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            transition={motionDisabled ? { duration: 0 } : { layout: { duration: 0.22 }, opacity: { duration: 0.16 }, height: { duration: 0.22 } }}
          >
            <h2 className="sticky top-2 z-10 mb-2 rounded-xl px-3 py-2 text-sm font-semibold text-muted-foreground glass-strong" id={`transaction-day-${group.date}`}>{group.label}</h2>
            <ul className="space-y-2">
              <AnimatePresence initial={false}>
                {group.items.map((transaction) => {
                  const id = transaction._id ?? transaction.id
                  return (
                    <TransactionItem
                      key={id}
                      layout
                      highlighted={highlightedIds.has(id)}
                      isPhone={isPhone}
                      motionDisabled={motionDisabled}
                      onDelete={() => onDelete(transaction)}
                      onEdit={() => onEdit(transaction)}
                      minimumFractionDigits={2}
                      syncStatus={pendingSyncByEntityId?.get(String(id))}
                      timeZone={timeZone}
                      transaction={transaction}
                    />
                  )
                })}
              </AnimatePresence>
            </ul>
          </m.section>
        ))}
      </AnimatePresence>
      {hasNextPage && (
        <div className="flex justify-center">
          <Button disabled={isFetchingNextPage} onClick={onLoadMore} variant="outline">
            {isFetchingNextPage ? 'Loading…' : isFetchNextPageError ? 'Retry loading more' : 'Load more'}
          </Button>
        </div>
      )}
    </div>
  )
}

export function TrashList({ transactions, isLoading, isError, onRetry, onRestore, isRestoring, timeZone }) {
  if (isLoading) {
    return <div aria-busy="true" className="space-y-3">{Array.from({ length: 4 }, (_, index) => <div className="glass-flat h-[4.5rem] animate-pulse rounded-2xl" key={index} />)}</div>
  }
  if (isError) return <ErrorState description="We couldn’t load deleted transactions." onRetry={onRetry} title="Couldn’t load trash" />
  if (transactions.length === 0) return <EmptyState description="Deleted transactions will be kept here so you can restore them." title="Trash is empty" />

  return (
    <ul className="space-y-2">
      {transactions.map((transaction) => {
        const deletedDate = transaction.deletedAt
          ? formatTxnDate(transaction.deletedAt, { timeZone }) || 'Unknown date'
          : 'Unknown date'
        const id = transaction.id ?? transaction._id
        return (
          <li className="glass-flat flex flex-wrap items-center gap-3 rounded-2xl p-3 sm:flex-nowrap sm:p-4" key={id}>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{transaction.merchant?.trim() || transaction.note?.trim() || transaction.categoryId?.name || (transaction.type === 'transfer' ? `Transfer ${transaction.transferDirection ?? ''}` : 'Uncategorized')}</span>
              <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                {[transaction.categoryId?.name, transaction.walletId?.name, `Deleted ${deletedDate}`].filter(Boolean).join(' · ')}
              </span>
            </span>
            <span className="text-sm font-semibold tabular">{formatINR(transaction.amount, { minimumFractionDigits: 2 })}</span>
            <Button disabled={isRestoring} onClick={() => onRestore(transaction)} size="sm" variant="outline">Restore</Button>
          </li>
        )
      })}
    </ul>
  )
}

export default TransactionList
