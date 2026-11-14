const TYPES = [
  ['budget_approaching', 'Budget approaching'],
  ['budget_exceeded', 'Budget exceeded'],
  ['recurring_upcoming', 'Upcoming recurring payment'],
  ['recurring_failed', 'Recurring payment issue'],
  ['subscription_upcoming', 'Subscription renewal'],
  ['subscription_detected', 'Subscription to review'],
  ['goal_reached', 'Savings goal reached'],
  ['goal_milestone', 'Savings goal progress'],
  ['anomaly_detected', 'Spending anomaly'],
  ['spending_increase', 'Spending increase'],
]

function NotificationFilters({ status, type, severity, onStatusChange, onTypeChange, onSeverityChange }) {
  const selectClass = 'min-h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

  return (
    <section aria-label="Filter notifications" className="glass-flat flex flex-wrap items-end gap-3 rounded-2xl p-4">
      <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
        Read status
        <select className={selectClass} onChange={(event) => onStatusChange(event.target.value)} value={status}>
          <option value="all">All notifications</option>
          <option value="unread">Unread</option>
          <option value="read">Read</option>
        </select>
      </label>
      <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
        Notification type
        <select className={selectClass} onChange={(event) => onTypeChange(event.target.value)} value={type}>
          <option value="all">All types</option>
          {TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
        Severity
        <select className={selectClass} onChange={(event) => onSeverityChange(event.target.value)} value={severity}>
          <option value="all">All severities</option>
          {['info', 'warning', 'high', 'critical'].map((value) => (
            <option className="capitalize" key={value} value={value}>{value}</option>
          ))}
        </select>
      </label>
    </section>
  )
}

export default NotificationFilters
