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

export function startOfDay(timeZone, date = new Date()) {
  const off = tzOffsetMs(timeZone, date);
  const local = new Date(date.getTime() + off);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - off);
}

export function startOfMonth(timeZone, date = new Date(), monthOffset = 0) {
  const off = tzOffsetMs(timeZone, date);
  const local = new Date(date.getTime() + off);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + monthOffset, 1) - off);
}
