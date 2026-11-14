import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import EmptyState from '@/components/common/EmptyState.jsx'
import ErrorState from '@/components/common/ErrorState.jsx'
import PageHeader from '@/components/common/PageHeader.jsx'
import { Button } from '@/components/ui/button.jsx'
import FinancialHealthIndicators from '@/components/financial-health/FinancialHealthIndicators.jsx'
import FinancialHealthInsights from '@/components/financial-health/FinancialHealthInsights.jsx'
import FinancialHealthOverview from '@/components/financial-health/FinancialHealthOverview.jsx'
import HealthScoreCard from '@/components/financial-health/HealthScoreCard.jsx'
import { useFinancialHealth } from '@/hooks/useFinancialHealth.js'
import { useMotionDisabled } from '@/hooks/useMotionDisabled.js'
import { getErrorMessage } from '@/lib/errors.js'

function FinancialHealthLoading() {
  const motionDisabled = useMotionDisabled()
  const pulse = motionDisabled ? '' : 'animate-pulse'
  return (
    <div aria-busy="true" aria-label="Loading financial health score" className="space-y-4">
      <div className={`glass-flat h-56 rounded-2xl ${pulse}`} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => <div className={`glass-flat h-40 rounded-2xl ${pulse}`} key={index} />)}
      </div>
    </div>
  )
}

function FinancialHealth() {
  const health = useFinancialHealth()
  const motionDisabled = useMotionDisabled()
  const [refreshError, setRefreshError] = useState('')
  const scoreAvailable = typeof health.data?.score === 'number' && Number.isFinite(health.data.score)

  async function refresh() {
    setRefreshError('')
    try {
      const result = await health.refetch()
      if (result.isError) throw result.error
      toast.success('Financial health score refreshed')
    } catch (error) {
      const message = getErrorMessage(error, 'Could not refresh the financial health score.')
      setRefreshError(message)
      toast.error(message)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        action={(
          <Button aria-busy={health.isFetching} disabled={health.isPending || health.isFetching} onClick={refresh} variant="outline">
            <RefreshCw aria-hidden="true" className={health.isFetching && !motionDisabled ? 'animate-spin' : ''} />
            Refresh
          </Button>
        )}
        description="Understand the financial indicators supported by your recorded activity."
        eyebrow="Financial wellbeing"
        title="Financial Health"
      />

      {refreshError && !health.isError && <p className="text-sm text-destructive" role="alert">{refreshError}</p>}
      {health.isPending ? (
        <FinancialHealthLoading />
      ) : health.isError ? (
        <ErrorState
          description={getErrorMessage(health.error, 'Your financial health score could not be loaded. Check your connection and try again.')}
          onRetry={() => health.refetch()}
          title="Couldn’t load your financial health score"
        />
      ) : !scoreAvailable ? (
        <EmptyState
          action={(
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild><Link to="/transactions">Add transactions</Link></Button>
              <Button asChild variant="outline"><Link to="/budgets">Review budgets</Link></Button>
            </div>
          )}
          description="There is not enough supported financial information to calculate a score yet. Record confirmed income or expenses across multiple months, then refresh. No score has been estimated. Budgets, savings goals and recurring activity can provide additional indicators."
          title="More financial activity is needed"
        />
      ) : (
        <div className="space-y-6">
          <HealthScoreCard
            confidence={health.data.dataConfidence}
            grade={health.data.grade}
            period={health.data.period}
            score={health.data.score}
          />
          <FinancialHealthOverview dimensions={health.data.dimensions} />
          <FinancialHealthIndicators
            areas={health.data.areasNeedingImprovement}
            dimensions={health.data.dimensions}
            positiveHabits={health.data.positiveHabits}
          />
          <FinancialHealthInsights
            areas={health.data.areasNeedingImprovement}
            dimensions={health.data.dimensions}
            positiveHabits={health.data.positiveHabits}
          />
          {Array.isArray(health.data.limitations) && health.data.limitations.length > 0 && (
            <section aria-labelledby="score-limitations-title" className="rounded-2xl border border-border/60 bg-muted/20 p-4">
              <h2 className="text-sm font-semibold" id="score-limitations-title">Score limitations</h2>
              <ul className="mt-2 list-inside list-disc space-y-1 text-xs leading-relaxed text-muted-foreground">
                {health.data.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

export default FinancialHealth
