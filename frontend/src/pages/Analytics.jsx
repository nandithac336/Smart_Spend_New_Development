import { useState } from 'react'
import { toast } from 'sonner'
import AnalyticsCharts from '@/components/analytics/AnalyticsCharts.jsx'
import AnalyticsFilters from '@/components/analytics/AnalyticsFilters.jsx'
import AnalyticsInsights from '@/components/analytics/AnalyticsInsights.jsx'
import AnalyticsReports from '@/components/analytics/AnalyticsReports.jsx'
import AnalyticsSummary from '@/components/analytics/AnalyticsSummary.jsx'
import ErrorState from '@/components/common/ErrorState.jsx'
import PageHeader from '@/components/common/PageHeader.jsx'
import { useAnalytics } from '@/hooks/useAnalytics.js'
import { useAuth } from '@/hooks/useAuth.js'
import { useMotionDisabled } from '@/hooks/useMotionDisabled.js'
import { getAnalyticsDefaults, getAnalyticsParams, isValidAnalyticsRange } from '@/lib/analyticsFilters.js'
import { downloadAnalyticsExport, saveAnalyticsExport } from '@/services/analyticsApi.js'

function AnalyticsLoading() {
  const motionDisabled = useMotionDisabled()
  const animation = motionDisabled ? '' : 'animate-pulse'
  return (
    <div aria-busy="true" aria-label="Loading analytics" className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => <div className={`glass-flat h-28 rounded-2xl ${animation}`} key={index} />)}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => <div className={`glass-flat h-80 rounded-2xl ${animation}`} key={index} />)}
      </div>
    </div>
  )
}

function Analytics() {
  const { user } = useAuth()
  const timeZone = user?.timezone || 'Asia/Kolkata'
  const [selection, setSelection] = useState(() => getAnalyticsDefaults(timeZone))
  const [busyFormat, setBusyFormat] = useState('')
  const params = getAnalyticsParams({ ...selection, timeZone })
  const rangeValid = selection.period !== 'custom' ||
    isValidAnalyticsRange(selection.startDate, selection.endDate)
  const analytics = useAnalytics(params, rangeValid)

  function updatePeriod(period) {
    setSelection((current) => ({ ...current, period }))
  }

  function updateDate(field, value) {
    setSelection((current) => ({ ...current, [field]: value }))
  }

  async function exportReport(format) {
    setBusyFormat(format)
    try {
      const report = await downloadAnalyticsExport(format, params)
      saveAnalyticsExport(report)
      toast.success(`${format.toUpperCase()} report downloaded`)
    } catch {
      toast.error(`Could not download the ${format.toUpperCase()} report. Please try again.`)
    } finally {
      setBusyFormat('')
    }
  }

  const showError = analytics.isError

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        description="See where your money is going, track progress, and export reports from your actual transactions."
        eyebrow="Your financial picture"
        title="Analytics & Reports"
      />
      <AnalyticsFilters
        endDate={selection.endDate}
        isRangeValid={rangeValid}
        onDateChange={updateDate}
        onPeriodChange={updatePeriod}
        period={selection.period}
        startDate={selection.startDate}
        timeZone={timeZone}
      />
      {!rangeValid && (
        <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive" role="alert">
          Choose a valid date range with the start date on or before the end date.
        </p>
      )}
      {!rangeValid ? null : analytics.isPending ? (
        <AnalyticsLoading />
      ) : showError ? (
        <ErrorState
          description="Analytics could not be loaded. Check your connection and try again."
          onRetry={() => analytics.refetch()}
          title="Couldn’t load analytics"
        />
      ) : (
        <div className="space-y-5 sm:space-y-6">
          <AnalyticsSummary summary={analytics.data.summary} />
          <AnalyticsCharts data={analytics.data} period={selection.period} timeZone={timeZone} />
          <AnalyticsInsights data={analytics.data} timeZone={timeZone} />
          <AnalyticsReports
            busyFormat={busyFormat}
            disabled={!rangeValid}
            onExport={exportReport}
          />
        </div>
      )}
    </div>
  )
}

export default Analytics
