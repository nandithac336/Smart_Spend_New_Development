function localDateKey(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return `${values.year}-${values.month}-${values.day}`
}

export function transactionSummaryParams(searchParams, timeZone, now = new Date()) {
  const filters = { timezone: timeZone }
  const walletId = searchParams.get('walletId')
  const categoryId = searchParams.get('categoryId')
  if (walletId) filters.walletId = walletId
  if (categoryId) filters.categoryId = categoryId

  const datePreset = searchParams.get('datePreset')
  if (datePreset === 'week') {
    filters.period = 'week'
  } else if (datePreset === 'year') {
    filters.period = 'year'
  } else if (datePreset === 'custom') {
    const startDate = searchParams.get('fromDate')
    const endDate = searchParams.get('toDate')
    if (!startDate || !endDate) return { filters: null, label: 'Selected dates' }
    filters.period = 'custom'
    filters.startDate = startDate
    filters.endDate = endDate
  } else if (datePreset === 'today') {
    const today = localDateKey(now, timeZone)
    filters.period = 'custom'
    filters.startDate = today
    filters.endDate = today
  } else {
    filters.period = 'month'
  }

  const periodLabel = datePreset === 'today'
    ? 'Today'
    : datePreset === 'week'
      ? 'This week'
      : datePreset === 'year'
        ? 'This year'
        : datePreset === 'custom'
          ? 'Selected dates'
          : 'This month'

  return { filters, label: periodLabel }
}
