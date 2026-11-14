// Timezone helpers so "today" and "this month" match the user's local calendar.

export function isValidTimeZone(timeZone) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

function tzOffsetMs(timeZone, date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(date)
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, p.value])
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

// Converts a UTC-midnight calendar date to midnight in the requested timezone.
export function startOfLocalDate(timeZone, calendarDate) {
  const date = new Date(calendarDate);
  if (Number.isNaN(date.getTime())) throw new RangeError("Invalid calendar date");

  const localMidnight = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  let timestamp = localMidnight;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const adjusted = localMidnight - tzOffsetMs(timeZone, new Date(timestamp));
    if (adjusted === timestamp) break;
    timestamp = adjusted;
  }
  return new Date(timestamp);
}

export function startOfDay(timeZone, date = new Date(), dayOffset = 0) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.filter((part) => part.type !== "literal").map(({ type, value }) => [type, value])
  );
  const calendarDate = new Date(Date.UTC(+values.year, +values.month - 1, +values.day + dayOffset));
  return startOfLocalDate(timeZone, calendarDate);
}

export function startOfMonth(timeZone, date = new Date(), monthOffset = 0) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.filter((part) => part.type !== "literal").map(({ type, value }) => [type, value])
  );
  const calendarDate = new Date(Date.UTC(+values.year, +values.month - 1 + monthOffset, 1));
  return startOfLocalDate(timeZone, calendarDate);
}
