import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import EmptyState from '@/components/common/EmptyState.jsx'
import Amount from '@/components/common/Amount.jsx'
import { formatINR } from '@/lib/money.js'

const CATEGORY_COLORS = ['#9b8cff', '#42b8f5', '#4dd5b0', '#f4b65f', '#f4779b', '#8ba4ff', '#50c7c7']
const TOOLTIP_STYLE = {
  backgroundColor: '#111827',
  border: '1px solid rgba(148, 163, 184, 0.2)',
  borderRadius: '12px',
  color: '#f8fafc',
}

function displayDate(value, timeZone, options = { month: 'short', day: 'numeric' }) {
  if (!value) return ''
  const date = new Date(`${value}T12:00:00.000Z`)
  return new Intl.DateTimeFormat('en-IN', { ...options, timeZone }).format(date)
}

function CurrencyAxis({ value }) {
  return formatINR(value)
}

function ChartPanel({ title, description, children, className = '' }) {
  return (
    <section className={`glass-flat min-w-0 rounded-2xl p-4 sm:p-5 ${className}`}>
      <div className="mb-4">
        <h2 className="text-sm font-semibold sm:text-base">{title}</h2>
        {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  )
}

function ChartEmpty({ text = 'There is no transaction data for this period.' }) {
  return <EmptyState className="min-h-48 border-0 bg-transparent shadow-none" description={text} title="Nothing to chart yet" />
}

function AnalyticsCharts({ data, period, timeZone }) {
  const trend = period === 'week' ? data.incomeExpense?.data : data.monthly?.data
  const daily = data.summary?.expenseCount > 0 ? data.daily?.data : []
  const categories = data.categories?.categories ?? []
  const wallets = data.wallets?.wallets ?? []

  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-2">
      <ChartPanel
        description={period === 'week' ? 'Income and expenses grouped by week.' : 'Income and expenses grouped by month.'}
        title="Income vs. expenses"
      >
        {trend?.length ? (
          <div aria-label="Income and expense trend chart" className="h-64 w-full" data-testid="income-expense-chart">
            <ResponsiveContainer height="100%" width="100%">
              <LineChart data={trend} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
                <XAxis dataKey="date" interval="preserveStartEnd" tickFormatter={(value) => displayDate(value, timeZone, { month: 'short', year: '2-digit' })} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis tickFormatter={CurrencyAxis} tick={{ fill: '#94a3b8', fontSize: 10 }} width={68} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value, name) => [formatINR(value), name === 'income' ? 'Income' : 'Expenses']} labelFormatter={(value) => displayDate(value, timeZone)} />
                <Legend formatter={(value) => value === 'income' ? 'Income' : 'Expenses'} />
                <Line dataKey="income" dot={false} name="income" stroke="#4dd5b0" strokeWidth={2.5} type="monotone" />
                <Line dataKey="expense" dot={false} name="expense" stroke="#f4779b" strokeWidth={2.5} type="monotone" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : <ChartEmpty />}
      </ChartPanel>

      <ChartPanel
        description="Daily confirmed expenses for the selected dates."
        title="Daily spending"
      >
        {daily?.length ? (
          <div aria-label="Daily spending chart" className="h-64 w-full" data-testid="daily-spending-chart">
            <ResponsiveContainer height="100%" width="100%">
              <LineChart data={daily} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
                <XAxis dataKey="date" interval="preserveStartEnd" tickFormatter={(value) => displayDate(value, timeZone)} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis tickFormatter={CurrencyAxis} tick={{ fill: '#94a3b8', fontSize: 10 }} width={68} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => [formatINR(value), 'Expenses']} labelFormatter={(value) => displayDate(value, timeZone)} />
                <Line dataKey="amount" dot={false} name="Expenses" stroke="#9b8cff" strokeWidth={2.5} type="monotone" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : <ChartEmpty text="Daily charts are available for ranges up to 366 days." />}
      </ChartPanel>

      <ChartPanel description="Share of confirmed expenses by category." title="Spending by category">
        {categories.length ? (
          <div>
            <div aria-label="Category spending chart" className="h-56 w-full" data-testid="category-spending-chart">
              <ResponsiveContainer height="100%" width="100%">
                <PieChart>
                  <Pie data={categories} dataKey="total" innerRadius={58} nameKey="name" outerRadius={92} paddingAngle={2}>
                    {categories.map((category, index) => (
                      <Cell fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} key={category.categoryId ?? category.name} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => [formatINR(value), 'Expenses']} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="mt-2 space-y-2">
              {categories.slice(0, 5).map((category, index) => (
                <li className="flex items-center justify-between gap-3 text-xs" key={category.categoryId ?? category.name}>
                  <span className="flex min-w-0 items-center gap-2">
                    <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }} />
                    <span className="truncate">{category.name}</span>
                  </span>
                  <span className="shrink-0 text-muted-foreground">
                    <Amount className="text-xs" value={category.total} /> · {category.percentage}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : <ChartEmpty />}
      </ChartPanel>

      <ChartPanel description="Income and expenses recorded in each wallet." title="Wallet activity">
        {wallets.length ? (
          <div aria-label="Wallet activity chart" className="h-64 w-full" data-testid="wallet-activity-chart">
            <ResponsiveContainer height="100%" width="100%">
              <BarChart data={wallets} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
                <XAxis dataKey="name" interval={0} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <YAxis tickFormatter={CurrencyAxis} tick={{ fill: '#94a3b8', fontSize: 10 }} width={68} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value, name) => [formatINR(value), name === 'income' ? 'Income' : 'Expenses']} />
                <Legend formatter={(value) => value === 'income' ? 'Income' : 'Expenses'} />
                <Bar dataKey="income" fill="#4dd5b0" name="income" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" fill="#f4779b" name="expense" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : <ChartEmpty />}
      </ChartPanel>
    </div>
  )
}

export default AnalyticsCharts
