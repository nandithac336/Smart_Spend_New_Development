import { useState } from 'react'
import { RefreshCw, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import ErrorState from '@/components/common/ErrorState.jsx'
import PageHeader from '@/components/common/PageHeader.jsx'
import { Button } from '@/components/ui/button.jsx'
import PredictionCharts from '@/components/predictions/PredictionCharts.jsx'
import PredictionSummary from '@/components/predictions/PredictionSummary.jsx'
import { useExpensePredictions } from '@/hooks/useExpensePredictions.js'
import { useMotionDisabled } from '@/hooks/useMotionDisabled.js'
import { formatINR } from '@/lib/money.js'

function monthLabel(monthKey) {
  const date = new Date(`${monthKey}-01T12:00:00.000Z`)
  return new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date)
}

function PredictionLoading() {
  const motionDisabled = useMotionDisabled()
  const animation = motionDisabled ? '' : 'animate-pulse'
  return (
    <div aria-busy="true" aria-label="Loading expense predictions" className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => <div className={`glass-flat h-28 rounded-2xl ${animation}`} key={index} />)}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {Array.from({ length: 2 }, (_, index) => <div className={`glass-flat h-80 rounded-2xl ${animation}`} key={index} />)}
      </div>
    </div>
  )
}

function ExpensePredictions() {
  const [selectedMonth, setSelectedMonth] = useState('')
  const predictions = useExpensePredictions(selectedMonth || undefined)

  async function refresh() {
    try {
      const result = await predictions.refetch()
      if (result.isError) throw result.error
      toast.success('Expense predictions refreshed')
    } catch {
      toast.error('Could not refresh predictions. Please try again.')
    }
  }

  const overview = predictions.data?.overview
  const current = overview?.currentMonth
  const next = overview?.nextMonth
  const chosenKey = selectedMonth || current?.forecastPeriod
  const selected = chosenKey === next?.forecastPeriod ? next : current
  const label = chosenKey ? monthLabel(chosenKey) : ''
  const dailyTimeZone = predictions.data?.daily?.timezone || overview?.timezone || 'Asia/Kolkata'
  const loading = predictions.isPending

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        action={(
          <Button disabled={loading || predictions.isFetching} onClick={refresh} variant="outline">
            <RefreshCw aria-hidden="true" className={predictions.isFetching ? 'animate-spin' : ''} />
            Refresh
          </Button>
        )}
        description="Explore estimates based on your confirmed expense history. Forecasts are not guaranteed future expenses."
        eyebrow="Plan with context"
        title="Expense Predictions"
      />

      {loading ? <PredictionLoading /> : predictions.isError ? (
        <ErrorState
          description="Expense predictions could not be loaded. Check your connection and try again."
          onRetry={() => predictions.refetch()}
          title="Couldn’t load predictions"
        />
      ) : (
        <>
          <section aria-label="Prediction period" className="glass-flat flex flex-wrap items-center justify-between gap-4 rounded-2xl p-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Prediction period</p>
              <p className="mt-1 text-lg font-semibold">{label}</p>
            </div>
            <div className="flex rounded-xl border border-border/70 bg-background/40 p-1" role="group" aria-label="Select prediction month">
              {[current, next].filter(Boolean).map((period, index) => {
                const text = `${index === 0 ? 'This month' : 'Next month'} · ${monthLabel(period.forecastPeriod)}`
                return (
                  <button
                    aria-pressed={period.forecastPeriod === chosenKey}
                    className={`min-h-9 rounded-lg px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${period.forecastPeriod === chosenKey ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    key={period.forecastPeriod}
                    onClick={() => setSelectedMonth(period.forecastPeriod)}
                    type="button"
                  >
                    {text}
                  </button>
                )
              })}
            </div>
          </section>

          {selected?.status !== 'ok' && (
            <section className="rounded-2xl border border-primary/20 bg-primary/5 p-4" role="status">
              <div className="flex items-start gap-3">
                <Sparkles aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
                <div>
                  <h2 className="text-sm font-semibold">More history is needed for a reliable estimate</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {selected?.message || 'At least three active historical months are needed. Known scheduled payments, when available, are shown separately.'}
                  </p>
                </div>
              </div>
            </section>
          )}

          <PredictionSummary monthLabel={label} prediction={selected} />

          {selected?.status === 'ok' && (
            <section className="glass-flat flex flex-wrap items-start justify-between gap-3 rounded-2xl p-4 sm:p-5">
              <div>
                <h2 className="text-sm font-semibold">Forecast confidence: {selected.confidence?.level || 'not provided'}</h2>
                <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
                  Confidence reflects historical sample coverage only, not a probability that the estimate will be accurate.
                  {selected.modelMethodology ? ` ${selected.modelMethodology}` : ''}
                </p>
              </div>
              {selected.predictedAmountPaise !== null && (
                <p className="text-xs text-muted-foreground">
                  Expected total: <span className="font-semibold text-foreground">{formatINR(selected.predictedAmountPaise)}</span>
                </p>
              )}
            </section>
          )}

          <PredictionCharts
            categories={predictions.data?.categories}
            daily={predictions.data?.daily}
            timeZone={dailyTimeZone}
          />

          <section className="rounded-2xl border border-border/60 bg-muted/20 p-4">
            <h2 className="text-xs font-semibold">How to read these estimates</h2>
            <ul className="mt-2 list-inside list-disc space-y-1 text-xs leading-relaxed text-muted-foreground">
              {(overview?.limitations ?? []).map((limitation) => <li key={limitation}>{limitation}</li>)}
              <li>Variable estimates and known scheduled obligations are displayed separately; scheduled payments are not newly created transactions.</li>
            </ul>
            {predictions.data?.categories?.methodology && (
              <p className="mt-3 text-xs text-muted-foreground">Category method: {predictions.data.categories.methodology}</p>
            )}
          </section>
        </>
      )}
    </div>
  )
}

export default ExpensePredictions
