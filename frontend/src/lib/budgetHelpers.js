const DAY_MS = 86_400_000

export function currentMonthInTimeZone(timeZone, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now)
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return `${values.year}-${values.month}`
}

export function budgetDateRange(budget) {
  return {
    start: new Date(budget.startDate).toISOString().slice(0, 10),
    end: new Date(budget.endDate).toISOString().slice(0, 10),
  }
}

export function budgetsForMonth(budgets, month) {
  const [year, monthNumber] = month.split('-').map(Number)
  const start = `${month}-01`
  const end = new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10)
  return budgets.filter((budget) => {
    const range = budgetDateRange(budget)
    return range.start <= end && range.end >= start
  })
}

export function getBudgetTotals(budgets) {
  return budgets.reduce((totals, budget) => {
    const amount = budget.progress?.budgetAmount ?? budget.amount
    const spent = budget.progress?.actualSpending ?? 0
    totals.allocated += amount
    totals.spent += spent
    totals.remaining += amount - spent
    return totals
  }, { allocated: 0, spent: 0, remaining: 0 })
}

export function makeBudgetPayload(values, toPaise) {
  let startDate
  let endDate
  if (values.period === 'monthly') {
    const [year, month] = values.month.split('-').map(Number)
    startDate = `${values.month}-01`
    endDate = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10)
  } else if (values.period === 'weekly') {
    startDate = values.weekStart
    endDate = new Date(new Date(`${startDate}T00:00:00.000Z`).getTime() + 6 * DAY_MS)
      .toISOString()
      .slice(0, 10)
  } else if (values.period === 'yearly') {
    startDate = `${values.year}-01-01`
    endDate = `${values.year}-12-31`
  } else {
    startDate = values.customStart
    endDate = values.customEnd
  }

  return {
    name: values.name.trim(),
    amount: toPaise(values.amount),
    categoryId: values.categoryId || null,
    period: values.period,
    startDate,
    endDate,
  }
}

export function validCalendarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}
