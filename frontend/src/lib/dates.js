const DEFAULT_TIME_ZONE = 'Asia/Kolkata'

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
