function AnalyticsFilters({
  period,
  startDate,
  endDate,
  onPeriodChange,
  onDateChange,
  isRangeValid,
  timeZone,
}) {
  return (
    <section aria-label="Analytics date range" className="glass-flat flex flex-col gap-4 rounded-2xl p-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="analytics-period">
          Reporting period
        </label>
        <select
          className="h-10 min-w-44 rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          id="analytics-period"
          onChange={(event) => onPeriodChange(event.target.value)}
          value={period}
        >
          <option value="week">This week</option>
          <option value="month">This month</option>
          <option value="year">This year</option>
          <option value="custom">Custom range</option>
        </select>
      </div>
      {period === 'custom' && (
        <div className="grid gap-3 sm:grid-cols-2 sm:items-end">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="analytics-start-date">
              From
            </label>
            <input
              aria-invalid={!isRangeValid}
              className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/50 aria-invalid:border-destructive"
              id="analytics-start-date"
              max={endDate || undefined}
              onChange={(event) => onDateChange('startDate', event.target.value)}
              type="date"
              value={startDate}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="analytics-end-date">
              To
            </label>
            <input
              aria-invalid={!isRangeValid}
              className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/50 aria-invalid:border-destructive"
              id="analytics-end-date"
              min={startDate || undefined}
              onChange={(event) => onDateChange('endDate', event.target.value)}
              type="date"
              value={endDate}
            />
          </div>
        </div>
      )}
      <p className="text-xs text-muted-foreground sm:max-w-52 sm:text-right">
        Calendar dates use {timeZone}.
      </p>
    </section>
  )
}

export default AnalyticsFilters
