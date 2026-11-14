import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import Amount from '@/components/common/Amount.jsx'
import GlassCard from '@/components/common/GlassCard.jsx'
import { useLowPower } from '@/hooks/useLowPower.js'
import { formatINR } from '@/lib/money.js'

function findDimension(dimensions, name) {
  return dimensions.find((item) => item?.name === name)?.figures
}

function FinancialHealthOverview({ dimensions = [] }) {
  const { lowPower } = useLowPower()
  const availableDimensions = Array.isArray(dimensions) ? dimensions.filter(Boolean) : []
  const income = findDimension(availableDimensions, 'Income versus expenses')
  const savings = findDimension(availableDimensions, 'Savings rate')
  const metrics = [
    ['Average monthly income', income?.averageMonthlyIncomePaise, 'money'],
    ['Average monthly expenses', income?.averageMonthlyExpensesPaise, 'money'],
    ['Net savings in period', savings?.netSavingsPaise, 'money'],
    ['Savings rate', savings?.savingsRatePercent, 'percent'],
  ].filter(([, value]) => typeof value === 'number' && Number.isFinite(value))
  const trend = findDimension(availableDimensions, 'Spending consistency and trends')
    ?.monthlyExpensesPaise
    ?.filter((item) => item && typeof item.month === 'string' && Number.isFinite(item.amountPaise))
    .map((item) => ({ month: item.month, amountPaise: item.amountPaise })) ?? []

  return (
    <section aria-labelledby="financial-overview-title" className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold" id="financial-overview-title">Financial overview</h2>
        <p className="mt-1 text-sm text-muted-foreground">Summary figures and spending history returned by the score service.</p>
      </div>
      {metrics.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map(([label, value, type]) => (
            <GlassCard className="p-4" key={label} variant={lowPower ? 'flat' : 'default'}>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-2 text-lg font-semibold tabular">
                {type === 'money' ? <Amount value={value} /> : `${value}%`}
              </p>
            </GlassCard>
          ))}
        </div>
      )}
      {trend.length > 0 && (
        <GlassCard className="min-w-0 p-4 sm:p-5" variant={lowPower ? 'flat' : 'default'}>
          <h3 className="text-sm font-semibold">Recorded monthly expenses</h3>
          <p className="mt-1 text-xs text-muted-foreground">Historical expense amounts provided by the backend; no forecast is shown.</p>
          <div aria-label="Recorded monthly expenses" className="mt-4 h-64 min-w-0 w-full" data-testid="financial-health-expense-chart">
            <ResponsiveContainer height="100%" width="100%">
              <LineChart data={trend} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <YAxis tickFormatter={formatINR} tick={{ fill: '#94a3b8', fontSize: 10 }} width={68} />
                <Tooltip formatter={(value) => formatINR(value)} />
                <Line dataKey="amountPaise" dot={{ r: 3 }} name="Recorded expenses" stroke="#9b8cff" strokeWidth={2.5} type="monotone" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      )}
      <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
        <h3 className="text-sm font-semibold">Score history</h3>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Historical score records are not available from the current service. This page shows the current score only and does not create a score trend.
        </p>
      </div>
      {metrics.length === 0 && trend.length === 0 && (
        <p className="text-xs text-muted-foreground">No overview figures were returned for this score.</p>
      )}
    </section>
  )
}

export default FinancialHealthOverview
