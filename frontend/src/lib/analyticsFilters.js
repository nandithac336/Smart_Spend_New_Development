function dateKeyInTimeZone(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return `${values.year}-${values.month}-${values.day}`
}

export function getAnalyticsDefaults(timeZone = 'Asia/Kolkata', now = new Date()) {
  const today = dateKeyInTimeZone(now, timeZone)
  return {
    period: 'month',
    startDate: `${today.slice(0, 7)}-01`,
    endDate: today,
  }
}

export function isCalendarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

export function isValidAnalyticsRange(startDate, endDate) {
  return isCalendarDate(startDate) && isCalendarDate(endDate) && startDate <= endDate
}

export function getAnalyticsDayCount(startDate, endDate) {
  if (!isValidAnalyticsRange(startDate, endDate)) return 0
  return (Date.parse(`${endDate}T00:00:00.000Z`) - Date.parse(`${startDate}T00:00:00.000Z`)) / 86_400_000 + 1
}

export function getAnalyticsParams({ period, startDate, endDate, timeZone }) {
  const params = { timezone: timeZone || 'Asia/Kolkata', period }
  if (period === 'custom') {
    params.startDate = startDate
    params.endDate = endDate
  }
  return params
}
