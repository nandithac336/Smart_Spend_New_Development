import { ArrowLeftRight, ArrowRight, Plus, Wallet as WalletIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import Amount from '@/components/common/Amount.jsx'
import EmptyState from '@/components/common/EmptyState.jsx'
import { formatTxnDate } from '@/lib/dates.js'
import { formatINR } from '@/lib/money.js'
import { Button } from '@/components/ui/button.jsx'

function descriptionOf(transaction) {
  return transaction.merchant?.trim()
    || transaction.note?.trim()
    || transaction.categoryId?.name?.trim()
    || (transaction.type === 'income' ? 'Income' : 'Expense')
}

function transactionDetails(transaction, timeZone, includeCategory = true) {
  const isTransfer = transaction.type === 'transfer'
  const details = [
    includeCategory && !isTransfer ? transaction.categoryId?.name || 'Uncategorized' : null,
    transaction.walletId?.name || 'Unknown wallet',
    formatTxnDate(transaction.txnDate, { timeZone }) || 'Date unavailable',
  ]
  return details.filter(Boolean)
}

function ActivityRow({ transaction, timeZone, motionDisabled, highlighted = false }) {
  const isTransfer = transaction.type === 'transfer'
  const title = isTransfer
    ? transaction.transferDirection === 'in' ? 'Transfer in' : 'Transfer out'
    : descriptionOf(transaction)
  const category = transaction.categoryId

  return (
    <li className={`dashboard-activity-row flex min-w-0 items-center gap-3 rounded-xl px-3 py-3 ${highlighted && !motionDisabled ? 'transaction-highlight' : ''}`}>
      <span className="dashboard-icon-badge flex size-10 shrink-0 items-center justify-center rounded-xl">
        {isTransfer
          ? <ArrowLeftRight aria-hidden="true" className="size-5" />
          : <span aria-hidden="true">{category?.icon || '📦'}</span>}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{title}</span>
        <span className="mt-1 block truncate text-xs text-muted-foreground">
          {transactionDetails(transaction, timeZone).join(' · ')}
        </span>
      </span>
      <Amount
        aria-label={`${isTransfer ? 'Transfer' : transaction.type} ${formatINR(transaction.amount)}`}
        className="text-sm"
        type={isTransfer ? 'neutral' : transaction.type}
        value={transaction.amount}
      />
    </li>
  )
}

export function DashboardRecentActivity({
  transactions,
  timeZone,
  highlightedTransactionIds,
  motionDisabled,
}) {
  if (transactions.length === 0) {
    return (
      <EmptyState
        action={(
          <Button onClick={() => window.dispatchEvent(new Event('smart-spend:open-quick-add'))}>
            <Plus aria-hidden="true" />
            Add your first expense
          </Button>
        )}
        description="Your spending and income activity will show up here."
        icon={WalletIcon}
        illustration={(
          <svg aria-hidden="true" className="empty-jar-illustration mb-4 size-24 overflow-visible text-primary" fill="none" viewBox="0 0 96 96">
            <path d="M35 38h26l-2.5 39h-21L35 38Z" className="jar-body" />
            <path d="M32 37h32v7H32zM39 31h18v6H39z" className="jar-rim" />
            <path d="M43 58c3-4 7-4 10 0" className="jar-smile" />
            <circle className="empty-jar-coin" cx="48" cy="18" r="7" />
            <path d="M45 18h6M48 15v6" className="coin-mark" />
            <path d="M28 80h40" className="jar-ground" />
          </svg>
        )}
        title="No transactions yet"
      />
    )
  }

  return (
    <>
      <ul className="dashboard-activity-list space-y-2">
        {transactions.map((transaction) => {
          const transactionId = transaction.id ?? transaction._id
          return (
            <ActivityRow
              highlighted={highlightedTransactionIds.has(transactionId)}
              key={transactionId}
              motionDisabled={motionDisabled}
              timeZone={timeZone}
              transaction={transaction}
            />
          )
        })}
      </ul>
      <div className="mt-3 flex justify-end">
        <Link className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline" to="/transactions">
          View all transactions <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </div>
    </>
  )
}

export function DashboardExpenseList({ expenses, timeZone, periodLabel = 'this month' }) {
  return (
    <section aria-labelledby="dashboard-expenses-heading" className="dashboard-panel-card rounded-2xl p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold" id="dashboard-expenses-heading">Where your money goes</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {periodLabel === 'this month' ? 'Recent expenses this month' : `Recent expenses in ${periodLabel}`}
          </p>
        </div>
        <Link
          className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline"
          to="/transactions?type=expense&datePreset=month"
        >
          View all <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </div>
      {expenses.length > 0 ? (
        <ul className="dashboard-activity-list space-y-2">
          {expenses.map((transaction) => (
            <ActivityRow
              key={transaction.id ?? transaction._id}
              motionDisabled
              timeZone={timeZone}
              transaction={transaction}
            />
          ))}
        </ul>
      ) : (
        <p className="dashboard-empty-card rounded-xl px-4 py-8 text-center text-sm text-muted-foreground">
          {periodLabel === 'this month'
            ? 'No expenses recorded this month yet.'
            : `No expenses recorded in ${periodLabel} yet.`}
        </p>
      )}
    </section>
  )
}
