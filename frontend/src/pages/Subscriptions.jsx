import { useMemo, useState } from 'react'
import { CalendarClock, RefreshCw, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import EmptyState from '@/components/common/EmptyState.jsx'
import ErrorState from '@/components/common/ErrorState.jsx'
import PageHeader from '@/components/common/PageHeader.jsx'
import SubscriptionCard from '@/components/subscriptions/SubscriptionCard.jsx'
import SubscriptionEditDialog from '@/components/subscriptions/SubscriptionEditDialog.jsx'
import SubscriptionFilters from '@/components/subscriptions/SubscriptionFilters.jsx'
import SubscriptionHistoryDialog from '@/components/subscriptions/SubscriptionHistoryDialog.jsx'
import SubscriptionLoading from '@/components/subscriptions/SubscriptionLoading.jsx'
import SubscriptionSummary from '@/components/subscriptions/SubscriptionSummary.jsx'
import SubscriptionUpcoming from '@/components/subscriptions/SubscriptionUpcoming.jsx'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog.jsx'
import { Button } from '@/components/ui/button.jsx'
import { useAuth } from '@/hooks/useAuth.js'
import { useCategories } from '@/hooks/useCategories.js'
import { useDebouncedValue } from '@/hooks/useDebouncedValue.js'
import { useSubscriptionHistory } from '@/hooks/useSubscriptionHistory.js'
import { useSubscriptionMutations, useSubscriptionSummary, useSubscriptions } from '@/hooks/useSubscriptions.js'

const pageSize = 12

function Subscriptions() {
  const { user } = useAuth()
  const timeZone = user?.timezone || 'Asia/Kolkata'
  const [status, setStatus] = useState('all')
  const [frequency, setFrequency] = useState('all')
  const [merchant, setMerchant] = useState('')
  const [page, setPage] = useState(1)
  const [editSubscription, setEditSubscription] = useState(null)
  const [historySubscription, setHistorySubscription] = useState(null)
  const [historyPage, setHistoryPage] = useState(1)
  const [cancelSubscription, setCancelSubscription] = useState(null)
  const categories = useCategories('expense')
  const debouncedMerchant = useDebouncedValue(merchant.trim())
  const listParams = useMemo(() => ({
    ...(status !== 'all' ? { status } : {}),
    ...(frequency !== 'all' ? { frequency } : {}),
    ...(debouncedMerchant ? { merchant: debouncedMerchant } : {}),
    page,
    limit: pageSize,
  }), [debouncedMerchant, frequency, page, status])
  const list = useSubscriptions(listParams)
  const summary = useSubscriptionSummary()
  const mutations = useSubscriptionMutations()
  const subscriptionId = historySubscription?.id ?? historySubscription?._id
  const historyQuery = useSubscriptionHistory(subscriptionId, Boolean(historySubscription), historyPage)
  const items = Array.isArray(list.data?.subscriptions) ? list.data.subscriptions : []
  const pagination = list.data?.pagination
  const categoryNames = new Map((categories.data ?? []).map((item) => [String(item.id ?? item._id), item.name]))
  const busy = mutations.confirm.isPending || mutations.dismiss.isPending || mutations.cancel.isPending || mutations.update.isPending

  async function scanTransactions() {
    try {
      const result = await mutations.detect.mutateAsync()
      const details = []
      if (Number.isFinite(result?.scannedTransactions)) details.push(`Checked ${result.scannedTransactions} transactions`)
      if (Number.isFinite(result?.detectedCount)) {
        details.push(`${result.detectedCount} detected for review`)
      }
      if (Number.isFinite(result?.insufficientEvidenceCount) && result.insufficientEvidenceCount > 0) {
        details.push(`${result.insufficientEvidenceCount} merchant pattern${result.insufficientEvidenceCount === 1 ? '' : 's'} need more evidence`)
      }
      if (result?.historyTruncated) details.push('History was truncated')
      toast.success(details.length ? details.join(' · ') : 'Subscription detection completed')
    } catch {
      // Mutation errors are reported by the mutation hook.
    }
  }

  async function refreshData() {
    const results = await Promise.all([list.refetch(), summary.refetch()])
    if (results.some((result) => result.isError)) {
      toast.error('Could not refresh subscription data.')
      return
    }
    toast.success('Subscription data refreshed')
  }

  async function performAction(mutation, subscription, successMessage) {
    try {
      await mutation.mutateAsync(subscription.id ?? subscription._id)
      setPage(1)
      toast.success(successMessage)
    } catch {
      // Mutation errors are reported by the mutation hook.
    }
  }

  async function saveSubscription(payload) {
    try {
      await mutations.update.mutateAsync({ id: editSubscription.id ?? editSubscription._id, payload })
      setEditSubscription(null)
      setPage(1)
      toast.success('Subscription details updated')
    } catch {
      // Mutation errors are reported by the mutation hook.
    }
  }

  async function cancelSelectedSubscription() {
    if (!cancelSubscription) return
    await performAction(mutations.cancel, cancelSubscription, 'Subscription cancelled')
    setCancelSubscription(null)
  }

  function changeFilter(setter, value) {
    setter(value)
    setPage(1)
  }

  const summaryError = summary.isError && !summary.isPending

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        action={(
          <div className="flex flex-wrap gap-2">
            <Button disabled={list.isFetching || summary.isFetching} onClick={refreshData} variant="outline">
              <RefreshCw aria-hidden="true" className={list.isFetching || summary.isFetching ? 'animate-spin' : ''} />
              Refresh
            </Button>
            <Button disabled={mutations.detect.isPending} onClick={scanTransactions}>
              <Sparkles aria-hidden="true" className={mutations.detect.isPending ? 'animate-pulse' : ''} />
              {mutations.detect.isPending ? 'Checking…' : 'Check transactions'}
            </Button>
          </div>
        )}
        description="Review repeated payments found in your confirmed transaction history. Detection creates a review item only; it never creates a transaction or confirms a subscription."
        eyebrow="Find recurring services"
        title="Subscription Detection"
      />

      <section aria-label="Subscription detection information" className="glass-strong flex items-start gap-3 rounded-2xl p-4 sm:p-5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <CalendarClock aria-hidden="true" className="size-5" />
        </span>
        <div>
          <h2 className="text-sm font-semibold">Detected patterns are suggestions, not schedules</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The backend checks up to five years of confirmed, non-trashed expense history, excluding transactions generated by recurring schedules. “Detected” items need your review; confirming one records your decision but does not create transactions or a recurring schedule.
          </p>
        </div>
      </section>

      <SubscriptionSummary isLoading={summary.isPending} summary={summary.data} />
      {summaryError && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3" role="alert">
          <p className="text-sm text-destructive">Subscription summary is unavailable.</p>
          <Button onClick={() => summary.refetch()} size="sm" variant="outline">Retry summary</Button>
        </div>
      )}
      {!summaryError && summary.data && (
        <SubscriptionUpcoming payments={summary.data.upcomingPayments} />
      )}

      <SubscriptionFilters
        frequency={frequency}
        merchant={merchant}
        onFrequencyChange={(value) => changeFilter(setFrequency, value)}
        onMerchantChange={(value) => changeFilter(setMerchant, value)}
        onStatusChange={(value) => changeFilter(setStatus, value)}
        status={status}
      />

      {list.isPending ? (
        <SubscriptionLoading />
      ) : list.isError ? (
        <ErrorState
          description="Subscription data could not be loaded. Check your connection and try again."
          onRetry={() => list.refetch()}
          title="Could not load subscriptions"
        />
      ) : items.length === 0 ? (
        <EmptyState
          action={<Button disabled={mutations.detect.isPending} onClick={scanTransactions}><Sparkles aria-hidden="true" />Check transaction history</Button>}
          description="No subscriptions match these filters. Scan your confirmed expense history to look for repeated payment patterns."
          icon={CalendarClock}
          title="No subscriptions to show"
        />
      ) : (
        <>
          <section aria-label="Subscriptions" className="grid gap-4 md:grid-cols-2">
            {items.map((subscription) => {
              const id = subscription.id ?? subscription._id
              const categoryName = subscription.categoryId
                ? categoryNames.get(String(subscription.categoryId))
                : ''
              return (
                <SubscriptionCard
                  busy={busy}
                  categoryName={categoryName}
                  key={id}
                  onCancel={setCancelSubscription}
                  onConfirm={(item) => performAction(mutations.confirm, item, 'Subscription confirmed')}
                  onDismiss={(item) => performAction(mutations.dismiss, item, 'Subscription dismissed')}
                  onEdit={setEditSubscription}
                  onHistory={(item) => { setHistoryPage(1); setHistorySubscription(item) }}
                  subscription={subscription}
                  timeZone={timeZone}
                />
              )
            })}
          </section>
          {pagination?.pages > 1 && (
            <nav aria-label="Subscription pages" className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Page {pagination.page} of {pagination.pages} · {pagination.total} subscriptions
              </p>
              <div className="flex gap-2">
                <Button disabled={page <= 1 || list.isFetching} onClick={() => setPage((value) => value - 1)} variant="outline">Previous</Button>
                <Button disabled={page >= pagination.pages || list.isFetching} onClick={() => setPage((value) => value + 1)} variant="outline">Next</Button>
              </div>
            </nav>
          )}
        </>
      )}

      {editSubscription && (
        <SubscriptionEditDialog
          busy={mutations.update.isPending}
          onClose={() => setEditSubscription(null)}
          onSave={saveSubscription}
          subscription={editSubscription}
        />
      )}
      {historySubscription && (
        <SubscriptionHistoryDialog
          onClose={() => setHistorySubscription(null)}
          onPageChange={setHistoryPage}
          page={historyPage}
          query={historyQuery}
          subscription={historySubscription}
          timeZone={timeZone}
        />
      )}
      <AlertDialog onOpenChange={(open) => { if (!open) setCancelSubscription(null) }} open={Boolean(cancelSubscription)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this confirmed subscription?</AlertDialogTitle>
            <AlertDialogDescription>
              This changes its tracking status to cancelled. It does not cancel the service with the merchant or change any transactions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutations.cancel.isPending}>Keep subscription</AlertDialogCancel>
            <AlertDialogAction disabled={mutations.cancel.isPending} onClick={(event) => { event.preventDefault(); cancelSelectedSubscription() }} variant="destructive">
              Cancel tracking
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default Subscriptions
