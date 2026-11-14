import { useMemo, useState } from 'react'
import { Plus, ReceiptText, ScanLine, Trash2, FileSpreadsheet, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth.js'
import { useTransactions } from '@/hooks/useTransactions.js'
import { useTrash } from '@/hooks/useTrash.js'
import { useTransactionMutations } from '@/hooks/useTransactionMutations.js'
import { useOfflineSync } from '@/hooks/useOfflineSync.js'
import PageHeader from '@/components/common/PageHeader.jsx'
import TransactionForm from '@/components/transactions/TransactionForm.jsx'
import TransactionList, { TrashList } from '@/components/transactions/TransactionList.jsx'
import TransactionsSummary from '@/components/transactions/TransactionsSummary.jsx'
import PendingTransactions from '@/components/offline/PendingTransactions.jsx'
import { TransactionFilters } from '@/components/transactions/TransactionFilters.jsx'
import {
  activeTransactionFilterCount,
  transactionFiltersFromParams,
} from '@/components/transactions/transactionFilterUtils.js'
import { Button } from '@/components/ui/button.jsx'

function Transactions() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuth()
  const timeZone = user?.timezone || 'Asia/Kolkata'
  const offlineSync = useOfflineSync(user?.id ?? user?._id)
  const isTrash = searchParams.get('view') === 'trash'
  const [editingTransaction, setEditingTransaction] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const mutations = useTransactionMutations()
  const filters = useMemo(() => transactionFiltersFromParams(searchParams), [searchParams])
  const transactionsQuery = useTransactions(filters, !isTrash)
  const trashQuery = useTrash(isTrash)
  const transactions = useMemo(
    () => (transactionsQuery.data?.pages ?? []).flatMap((page) => page.data ?? []),
    [transactionsQuery.data],
  )
  const trashTransactions = trashQuery.data ?? []
  const pendingSyncByEntityId = useMemo(() => new Map(
    offlineSync.operations
      .filter((item) => item.operation.entityId)
      .map((item) => [String(item.operation.entityId), item.status === 'conflict' ? 'Conflict; review in Sync Centre' : 'Change pending sync']),
  ), [offlineSync.operations])
  const filterCount = activeTransactionFilterCount(searchParams)

  function setView(view) {
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      if (view === 'trash') next.set('view', 'trash')
      else next.delete('view')
      return next
    }, { replace: true })
  }

  function clearFilters() {
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      for (const key of ['q', 'type', 'walletId', 'categoryId', 'datePreset', 'from', 'to', 'fromDate', 'toDate', 'minAmount', 'maxAmount', 'tag']) {
        next.delete(key)
      }
      return next
    }, { replace: true })
  }

  function beginCreate() {
    setEditingTransaction(null)
    setFormOpen(true)
  }

  function beginEdit(transaction) {
    setEditingTransaction(transaction)
    setFormOpen(true)
  }

  function deleteTransaction(transaction) {
    const id = transaction.id ?? transaction._id
    mutations.remove.mutate(transaction, {
      onSuccess: (result) => {
        if (result?.pendingSync) {
          toast('Delete queued; pending sync')
          return
        }
        toast('Moved to trash', {
          duration: 6000,
          action: {
            label: 'Undo',
            onClick: () => mutations.restore.mutate(id, {
              onSuccess: () => toast.success('Transaction restored'),
            }),
          },
        })
      },
    })
  }

  function restoreTransaction(transaction) {
    mutations.restore.mutate(transaction.id ?? transaction._id, {
      onSuccess: () => toast.success('Transaction restored'),
    })
  }

  return (
    <>
      <PageHeader
        action={!isTrash && (
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link to="/scans"><ScanLine aria-hidden="true" />Scan receipt / UPI</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/imports"><FileSpreadsheet aria-hidden="true" />Import statement</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/categorization"><Sparkles aria-hidden="true" />Review categories</Link>
            </Button>
            <Button onClick={beginCreate}>
              <Plus aria-hidden="true" />
              Add transaction
            </Button>
          </div>
        )}
        description="Review and manage your spending in one place."
        eyebrow="Your activity"
        title="Transactions"
      />
      <div className="space-y-5">
        {!isTrash && <TransactionsSummary searchParams={searchParams} timeZone={timeZone} />}
        {!isTrash && <PendingTransactions operations={offlineSync.operations} timeZone={timeZone} />}
        <div aria-label="Transaction lists" className="inline-flex w-fit max-w-full gap-1 rounded-xl border border-border/70 bg-card/60 p-1" role="tablist">
          <button
            aria-selected={!isTrash}
            className={`relative inline-flex min-h-10 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${!isTrash ? 'bg-accent text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => setView('all')}
            role="tab"
            type="button"
          >
            <span className="relative z-10 inline-flex items-center gap-2">
            <ReceiptText aria-hidden="true" className="size-4" />All
            </span>
          </button>
          <button
            aria-selected={isTrash}
            className={`relative inline-flex min-h-10 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${isTrash ? 'bg-accent text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => setView('trash')}
            role="tab"
            type="button"
          >
            <span className="relative z-10 inline-flex items-center gap-2">
            <Trash2 aria-hidden="true" className="size-4" />Trash
            </span>
          </button>
        </div>

        {isTrash ? (
          <TrashList
            isError={trashQuery.isError}
            isLoading={trashQuery.isPending}
            isRestoring={mutations.restore.isPending}
            onRestore={restoreTransaction}
            onRetry={() => trashQuery.refetch()}
            timeZone={timeZone}
            transactions={trashTransactions}
          />
        ) : (
          <>
            <TransactionFilters params={searchParams} setParams={setSearchParams} timeZone={timeZone} />
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {transactionsQuery.data?.pages?.[0]?.pagination?.total ?? 0} transactions
              {filterCount > 0 ? ` · ${filterCount} active ${filterCount === 1 ? 'filter' : 'filters'}` : ''}
            </p>
            <TransactionList
              hasFilters={filterCount > 0}
              highlightKey={JSON.stringify(filters)}
              hasNextPage={transactionsQuery.hasNextPage}
              isError={transactionsQuery.isError}
              isFetchNextPageError={transactionsQuery.isFetchNextPageError}
              isFetchingNextPage={transactionsQuery.isFetchingNextPage}
              isLoading={transactionsQuery.isPending}
              onClearFilters={clearFilters}
              onDelete={deleteTransaction}
              onEdit={beginEdit}
              onLoadMore={() => transactionsQuery.fetchNextPage()}
              onRetry={() => transactionsQuery.refetch()}
              pendingSyncByEntityId={pendingSyncByEntityId}
              timeZone={timeZone}
              transactions={transactions}
            />
          </>
        )}
      </div>
      {formOpen && (
        <TransactionForm
          key={editingTransaction ? editingTransaction.id ?? editingTransaction._id : 'new'}
          mutations={mutations}
          onClose={() => setFormOpen(false)}
          timeZone={timeZone}
          transaction={editingTransaction}
        />
      )}
    </>
  )
}

export default Transactions
