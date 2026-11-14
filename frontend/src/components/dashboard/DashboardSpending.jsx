import Amount from '@/components/common/Amount.jsx'
import { DashboardExpenseList, DashboardRecentActivity } from './DashboardActivity.jsx'

function CategoryChart({ categories, expenses, animated, periodLabel }) {
  if (categories.length === 0) {
    return (
      <div className="dashboard-empty-card flex min-h-44 items-center justify-center rounded-2xl px-5 text-center">
        <p className="max-w-xs text-sm text-muted-foreground">Category spending will appear here when you record expenses.</p>
      </div>
    )
  }

  const monthlyExpenses = Number(expenses) || 0

  return (
    <ul className="space-y-4">
      {categories.map((category) => {
        const total = Number(category.total) || 0
        const share = monthlyExpenses > 0 ? Math.min(100, Math.round((total / monthlyExpenses) * 100)) : 0
        const progressLabel = periodLabel === 'this month'
          ? `${category.name} share of this month’s expenses`
          : `${category.name} share of ${periodLabel} expenses`
        return (
          <li className="space-y-2" key={category.categoryId ?? category.name}>
            <div className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2">
                <span aria-hidden="true" className="text-base">{category.icon || '📦'}</span>
                <span className="truncate text-sm font-medium">{category.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{category.count ?? 0}</span>
              </span>
              <Amount className="text-sm" type="expense" value={total} />
            </div>
            <div
              aria-label={progressLabel}
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={share}
              className="dashboard-category-track h-2 overflow-hidden rounded-full"
              role="progressbar"
            >
              <div
                className={`dashboard-category-bar h-full rounded-full ${animated ? 'category-bar-animate' : ''}`}
                style={{ width: `${share}%` }}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function DashboardSpending({
  categories,
  expenses,
  recent,
  monthExpenses,
  timeZone,
  highlightedTransactionIds,
  animated,
  motionDisabled,
  periodLabel = 'this month',
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <section aria-labelledby="dashboard-categories-heading" className="dashboard-panel-card dashboard-enter-item rounded-2xl p-4 sm:p-5">
        <div className="mb-5">
          <h2 className="text-base font-semibold" id="dashboard-categories-heading">Spending by category</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {periodLabel === 'this month' ? 'All categories this month' : `All categories in ${periodLabel}`} · {categories.length} shown
          </p>
        </div>
        <CategoryChart animated={animated} categories={categories} expenses={expenses} periodLabel={periodLabel} />
      </section>

      <section aria-labelledby="dashboard-recent-heading">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold" id="dashboard-recent-heading">Recent activity</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Your latest transactions</p>
          </div>
        </div>
        <DashboardRecentActivity
          highlightedTransactionIds={highlightedTransactionIds}
          motionDisabled={motionDisabled}
          timeZone={timeZone}
          transactions={recent}
        />
      </section>
      <DashboardExpenseList expenses={monthExpenses} periodLabel={periodLabel} timeZone={timeZone} />
    </div>
  )
}

export default DashboardSpending
