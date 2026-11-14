import { useState } from 'react'
import { Activity, RefreshCw, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import AnomalyCard from '@/components/anomalies/AnomalyCard.jsx'
import AnomalyFilters from '@/components/anomalies/AnomalyFilters.jsx'
import AnomalySummary from '@/components/anomalies/AnomalySummary.jsx'
import EmptyState from '@/components/common/EmptyState.jsx'
import ErrorState from '@/components/common/ErrorState.jsx'
import PageHeader from '@/components/common/PageHeader.jsx'
import { Button } from '@/components/ui/button.jsx'
import { useAnomalies, useAnomalyMutations, useAnomalySummary } from '@/hooks/useAnomalies.js'
import { useAuth } from '@/hooks/useAuth.js'
import { getErrorMessage } from '@/lib/errors.js'

const EMPTY_FILTERS = { severity: '', status: '', startDate: '', endDate: '' }

function Anomalies() {
  const { user } = useAuth()
  const timeZone = user?.timezone || 'Asia/Kolkata'
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [page, setPage] = useState(1)
  const [actionError, setActionError] = useState('')
  const [refreshResult, setRefreshResult] = useState(null)
  const mutations = useAnomalyMutations()
  const dateRangeInvalid = Boolean(filters.startDate && filters.endDate && filters.startDate > filters.endDate)
  const query = useAnomalies({
    ...(filters.severity ? { severity: filters.severity } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.startDate ? { startDate: filters.startDate } : {}),
    ...(filters.endDate ? { endDate: filters.endDate } : {}),
    page,
    limit: 20,
  }, !dateRangeInvalid)
  const summaryQuery = useAnomalySummary()
  const anomalies = query.data?.anomalies ?? []
  const pagination = query.data?.pagination
  const detecting = mutations.detect.isPending

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }))
    setPage(1)
  }

  async function checkRecentActivity() {
    setActionError('')
    setRefreshResult(null)
    const request = filters.startDate && filters.endDate
      ? { startDate: filters.startDate, endDate: filters.endDate }
      : {}
    try {
      const result = await mutations.detect.mutateAsync(request)
      setRefreshResult(result)
      toast.success(`Checked ${result.scannedCount} transactions for unusual activity`)
    } catch (error) {
      setActionError(getErrorMessage(error, 'Couldn’t check recent transactions. Please try again.'))
    }
  }

  async function updateStatus(anomaly, status) {
    setActionError('')
    try {
      await mutations.updateStatus.mutateAsync({ id: anomaly._id, status })
      toast.success(status === 'dismissed' ? 'Anomaly dismissed' : 'Anomaly marked for review')
    } catch (error) {
      setActionError(getErrorMessage(error, 'Couldn’t update this anomaly. Please try again.'))
    }
  }

  const hasActiveFilters = Object.values(filters).some(Boolean)
  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        action={(
          <Button disabled={detecting || dateRangeInvalid} onClick={checkRecentActivity} type="button" variant="outline">
            {detecting ? <RefreshCw aria-hidden="true" className="animate-spin" /> : <Activity aria-hidden="true" />}
            {detecting ? 'Checking…' : 'Check recent activity'}
          </Button>
        )}
        description="Review activity that differs from your confirmed transaction patterns."
        eyebrow="Spending pattern review"
        title="Anomaly Detection"
      />
      <div className="flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 text-xs leading-relaxed text-amber-100" role="note">
        <ShieldAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        An anomaly is an unusual-spending signal, not a confirmed fraud finding. Detection never changes, blocks, or deletes transactions.
      </div>
      <AnomalySummary loading={summaryQuery.isLoading} summary={summaryQuery.data} />
      {summaryQuery.isError && <p className="text-xs text-muted-foreground" role="status">Overview counts are unavailable. The anomaly list can still be used.</p>}
      <AnomalyFilters disabled={detecting} filters={filters} onChange={updateFilter} onClear={() => { setFilters(EMPTY_FILTERS); setPage(1) }} />
      {dateRangeInvalid && <p className="text-sm text-destructive" role="alert">The detected-from date must be on or before the detected-to date.</p>}
      {refreshResult && (
        <p className="rounded-xl border border-primary/15 bg-primary/5 p-3 text-sm text-muted-foreground" role="status">
          Checked {refreshResult.scannedCount} confirmed transactions. {refreshResult.anomalies.length} anomaly records were returned; existing records are not duplicated.
          {refreshResult.insufficientBaselineCount > 0 && ` ${refreshResult.insufficientBaselineCount} transaction${refreshResult.insufficientBaselineCount === 1 ? ' had' : 's had'} limited history for comparison.`}
        </p>
      )}
      {actionError && <p className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive" role="alert">{actionError}</p>}
      {dateRangeInvalid ? (
        <EmptyState description="Correct the selected dates to see matching anomaly records." title="Check the date range" />
      ) : query.isLoading ? (
        <div aria-busy="true" aria-label="Loading anomalies" className="space-y-3">
          {[0, 1, 2].map((item) => <div className="glass-flat h-64 animate-pulse rounded-2xl" key={item} />)}
        </div>
      ) : query.isError ? (
        <ErrorState description="Your anomaly list could not be loaded." onRetry={() => query.refetch()} title="Couldn’t load unusual activity" />
      ) : anomalies.length === 0 ? (
        <EmptyState
          description={hasActiveFilters ? 'No unusual activity matches the selected filters. Try clearing one or more filters.' : 'No flagged activity is available yet. Check recent transactions to compare them against your confirmed history.'}
          icon={ShieldAlert}
          title={hasActiveFilters ? 'No matching anomalies' : 'No unusual activity found'}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
            <p>{pagination?.total ?? anomalies.length} flagged {pagination?.total === 1 ? 'item' : 'items'}</p>
            <Button disabled={query.isFetching} onClick={() => query.refetch()} size="sm" type="button" variant="ghost">
              <RefreshCw aria-hidden="true" className={query.isFetching ? 'animate-spin' : ''} />Refresh list
            </Button>
          </div>
          <div className="space-y-3">
            {anomalies.map((anomaly) => (
              <AnomalyCard
                anomaly={anomaly}
                busy={mutations.updateStatus.isPending}
                key={anomaly._id}
                onUpdateStatus={updateStatus}
                timeZone={timeZone}
              />
            ))}
          </div>
          {pagination?.pages > 1 && (
            <div className="flex items-center justify-between gap-3">
              <Button disabled={page <= 1} onClick={() => setPage((current) => current - 1)} type="button" variant="outline">Previous</Button>
              <span className="text-xs text-muted-foreground">Page {pagination.page} of {pagination.pages}</span>
              <Button disabled={page >= pagination.pages} onClick={() => setPage((current) => current + 1)} type="button" variant="outline">Next</Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default Anomalies
