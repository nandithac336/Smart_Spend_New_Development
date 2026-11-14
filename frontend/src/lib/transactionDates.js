function dateTimeParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  return Object.fromEntries(parts.map(({ type, value }) => [type, value]))
}

function dateKey(date, timeZone) {
  const parts = dateTimeParts(date, timeZone)
  return `${parts.year}-${parts.month}-${parts.day}`
}

export function formatDateTimeLocal(date, timeZone) {
  const parts = dateTimeParts(date, timeZone)
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
}

export function localDateTimeToIso(value, timeZone) {
  if (!value) return null
  const [date, time] = value.split('T')
  if (!date || !time) return null
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  const target = Date.UTC(year, month - 1, day, hour, minute)
  let result = target

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parts = dateTimeParts(new Date(result), timeZone)
    const represented = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
    )
    result += target - represented
  }

  return new Date(result).toISOString()
}

export function datePresetRange(preset, timeZone, now = new Date()) {
  const today = dateKey(now, timeZone)
  const [year, month, day] = today.split('-').map(Number)
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  const mondayOffset = (weekday + 6) % 7
  const weekStart = new Date(Date.UTC(year, month - 1, day - mondayOffset)).toISOString().slice(0, 10)
  const monthStart = `${today.slice(0, 7)}-01`
  const yearStart = `${year}-01-01`
  const from = preset === 'today'
    ? today
    : preset === 'week'
      ? weekStart
      : preset === 'year'
        ? yearStart
        : monthStart
  const start = localDateTimeToIso(`${from}T00:00`, timeZone)
  const end = localDateTimeToIso(`${today}T23:59`, timeZone)
  const endDate = new Date(new Date(end).getTime() + 59_999).toISOString()
  return { from: start, to: endDate }
}

export function dateOnlyRangeToIso(from, to, timeZone) {
  const validDate = (value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
    const parsed = new Date(`${value}T00:00:00.000Z`)
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
  }
  return {
    from: from && validDate(from) ? localDateTimeToIso(`${from}T00:00`, timeZone) : '',
    to: to && validDate(to) ? new Date(new Date(localDateTimeToIso(`${to}T23:59`, timeZone)).getTime() + 59_999).toISOString() : '',
  }
}
