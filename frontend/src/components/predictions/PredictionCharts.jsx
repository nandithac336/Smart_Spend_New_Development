import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import Amount from '@/components/common/Amount.jsx'
import EmptyState from '@/components/common/EmptyState.jsx'
import { formatINR } from '@/lib/money.js'

const TOOLTIP_STYLE = {
  backgroundColor: '#111827',
  border: '1px solid rgba(148, 163, 184, 0.2)',
  borderRadius: '12px',
  color: '#f8fafc',
}

function ChartPanel({ title, description, children }) {
  return (
    <section className="glass-flat min-w-0 rounded-2xl p-4 sm:p-5">
      <div className="mb-4">
        <h2 className="text-sm font-semibold sm:text-base">{title}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  )
}

function ChartEmpty({ text }) {
  return (
    <EmptyState
      className="min-h-48 border-0 bg-transparent shadow-none"
      description={text}
      title="Not enough data to chart"
    />
  )
}

function currencyAxis(value) {
  return formatINR(value)
}

function PredictionCharts({ categories, daily, timeZone }) {
  const comparable = (categories?.categories ?? [])
    .filter((item) => item.status === 'ok' && item.predictedAmountPaise !== null)
    .map((item) => ({
      name: item.name,
      previousMonthActualPaise: item.previousMonthActualPaise,
      predictedAmountPaise: item.predictedAmountPaise,
    }))
  const dailyData = (daily?.data ?? []).map((item) => ({
    date: item.date,
    actual: item.status === 'actual' ? item.actualAmountPaise : null,
    variableForecast: item.status === 'forecast' && item.predictedAmountPaise !== null
      ? Math.max(0, item.predictedAmountPaise - item.knownRecurringPaise)
      : null,
    scheduled: item.status === 'forecast' && item.knownRecurringPaise > 0
      ? item.knownRecurringPaise
      : null,
  }))

  function formatDate(value) {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone,
      day: 'numeric',
      month: 'short',
    }).format(new Date(`${value}T12:00:00.000Z`))
  }

  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-2">
      <ChartPanel
        description="Previous month is actual recorded spend; forecast values are estimates."
        title="Previous month vs. forecast by category"
      >
        {comparable.length ? (
          <div aria-label="Previous month and predicted category spending" className="h-72 w-full" data-testid="prediction-category-chart">
            <ResponsiveContainer height="100%" width="100%">
              <BarChart data={comparable} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
                <XAxis dataKey="name" interval={0} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <YAxis tickFormatter={currencyAxis} tick={{ fill: '#94a3b8', fontSize: 10 }} width={68} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value, name) => [
                  formatINR(value),
                  name === 'previousMonthActualPaise' ? 'Previous month actual' : 'Forecast',
                ]} />
                <Legend formatter={(name) => name === 'previousMonthActualPaise' ? 'Previous month actual' : 'Forecast'} />
                <Bar dataKey="previousMonthActualPaise" fill="#42b8f5" name="previousMonthActualPaise" radius={[4, 4, 0, 0]} />
                <Bar dataKey="predictedAmountPaise" fill="#9b8cff" name="predictedAmountPaise" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : <ChartEmpty text="Category forecasts need at least three active historical months." />}
      </ChartPanel>

      <ChartPanel
        description="Recorded daily spend is shown separately from estimated variable and scheduled expenses."
        title="Actual and expected daily spending"
      >
        {dailyData.length ? (
          <div aria-label="Actual and expected daily spending" className="h-72 w-full" data-testid="prediction-daily-chart">
            <ResponsiveContainer height="100%" width="100%">
              <LineChart data={dailyData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
                <XAxis dataKey="date" interval="preserveStartEnd" tickFormatter={formatDate} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <YAxis tickFormatter={currencyAxis} tick={{ fill: '#94a3b8', fontSize: 10 }} width={68} />
                <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={formatDate} formatter={(value, name) => [
                  formatINR(value),
                  name === 'actual' ? 'Actual expenses' : name === 'scheduled' ? 'Scheduled' : 'Variable estimate',
                ]} />
                <Legend formatter={(name) => name === 'actual' ? 'Actual expenses' : name === 'scheduled' ? 'Scheduled' : 'Variable estimate'} />
                <Line connectNulls={false} dataKey="actual" dot={false} name="actual" stroke="#42b8f5" strokeWidth={2.5} type="monotone" />
                <Line connectNulls={false} dataKey="variableForecast" dot={false} name="variableForecast" stroke="#9b8cff" strokeDasharray="5 4" strokeWidth={2.5} type="monotone" />
                <Line connectNulls={false} dataKey="scheduled" dot={false} name="scheduled" stroke="#4dd5b0" strokeDasharray="2 3" strokeWidth={2} type="monotone" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : <ChartEmpty text="Daily spending details are not available for this period." />}
      </ChartPanel>
      {categories?.categories?.length > 0 && (
        <section aria-label="Category forecast details" className="glass-flat rounded-2xl p-4 sm:p-5 xl:col-span-2">
          <h2 className="text-sm font-semibold sm:text-base">Category forecast details</h2>
          <ul className="mt-4 divide-y divide-border/60">
            {categories.categories.map((category) => (
              <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3 first:pt-0 last:pb-0" key={category.categoryId ?? category.name}>
                <div className="flex min-w-0 items-center gap-3">
                  <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm text-primary">
                    {category.icon || '•'}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{category.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {category.status === 'ok'
                        ? `${category.historicalSampleSize} active historical months`
                        : 'Insufficient history for a category forecast'}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-xs">
                  <span className="text-muted-foreground">Prior actual <Amount className="text-xs" value={category.previousMonthActualPaise ?? 0} /></span>
                  <span className="text-muted-foreground">Forecast {category.predictedAmountPaise === null ? '—' : <Amount className="text-xs" value={category.predictedAmountPaise} />}</span>
                  <span className="text-muted-foreground">Scheduled <Amount className="text-xs" value={category.knownRecurringPaise ?? 0} /></span>
                </div>
              </li>
            ))}
          </ul>
          {categories.categoriesTruncated && (
            <p className="mt-3 text-xs text-muted-foreground">The backend limited the category list; some categories may not be shown.</p>
          )}
        </section>
      )}
    </div>
  )
}

export default PredictionCharts
