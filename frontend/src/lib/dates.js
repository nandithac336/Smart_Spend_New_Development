const DEFAULT_TIME_ZONE = 'Asia/Kolkata'

function validDate(value) {
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date : null
}

function dayKey(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return `${values.year}-${values.month}-${values.day}`
}

function shiftDay(key, difference) {
  const [year, month, day] = key.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + difference))
  return date.toISOString().slice(0, 10)
}

export function formatTxnTime(value, timeZone = DEFAULT_TIME_ZONE) {
  const date = validDate(value)
  if (!date) return ''

  const parts = new Intl.DateTimeFormat('en-IN', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]))
  return `${values.hour}:${values.minute} ${values.dayPeriod.toLowerCase()}`
}

export function formatTxnDate(value, { timeZone = DEFAULT_TIME_ZONE, now = new Date() } = {}) {
  const date = validDate(value)
  const currentDate = validDate(now)
  if (!date || !currentDate) return ''

  const currentDay = dayKey(currentDate, timeZone)
  const dateDay = dayKey(date, timeZone)
  const relativeDate = dateDay === currentDay
    ? 'Today'
    : dateDay === shiftDay(currentDay, -1)
      ? 'Yesterday'
      : new Intl.DateTimeFormat('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          timeZone,
        }).format(date)
  return `${relativeDate}, ${formatTxnTime(date, timeZone)}`
}

export function groupByDay(
  items,
  { dateKey = 'txnDate', timeZone = DEFAULT_TIME_ZONE, now = new Date() } = {},
) {
  if (!Array.isArray(items)) throw new TypeError('items must be an array')

  const today = dayKey(now, timeZone)
  const yesterday = shiftDay(today, -1)
  const groups = new Map()

  for (const item of items) {
    const date = new Date(item[dateKey])
    if (!Number.isFinite(date.getTime())) {
      throw new TypeError(`Invalid date in "${dateKey}"`)
    }

    const key = dayKey(date, timeZone)
    if (!groups.has(key)) {
      const label = key === today
        ? 'Today'
        : key === yesterday
          ? 'Yesterday'
          : new Intl.DateTimeFormat('en-IN', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
              timeZone,
            }).format(date)
      groups.set(key, { date: key, label, items: [] })
    }
    groups.get(key).items.push(item)
  }

  return [...groups.values()]
}
