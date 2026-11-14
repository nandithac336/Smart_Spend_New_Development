import {
  AlertTriangle,
  ArrowUpRight,
  Bell,
  CalendarClock,
  Check,
  CircleAlert,
  Target,
  Trash2,
  Wallet,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button.jsx'
import { useLowPower } from '@/hooks/useLowPower.js'
import { formatTxnDate } from '@/lib/dates.js'

const TYPE_DETAILS = {
  budget_approaching: { label: 'Budget approaching', icon: Wallet, to: '/budgets' },
  budget_exceeded: { label: 'Budget exceeded', icon: Wallet, to: '/budgets' },
  recurring_upcoming: { label: 'Upcoming payment', icon: CalendarClock, to: '/recurring' },
  recurring_failed: { label: 'Recurring payment issue', icon: CalendarClock, to: '/recurring' },
  subscription_upcoming: { label: 'Subscription renewal', icon: CalendarClock, to: '/subscriptions' },
  subscription_detected: { label: 'Subscription to review', icon: CalendarClock, to: '/subscriptions' },
  goal_reached: { label: 'Savings goal reached', icon: Target, to: '/goals' },
  goal_milestone: { label: 'Savings goal progress', icon: Target, to: '/goals' },
  anomaly_detected: { label: 'Spending anomaly', icon: AlertTriangle, to: '/anomalies' },
  spending_increase: { label: 'Spending increase', icon: CircleAlert, to: '/analytics' },
}

const SEVERITY_STYLES = {
  info: 'border-accent-blue/20 bg-accent-blue/10 text-accent-blue',
  warning: 'border-warning/25 bg-warning/10 text-warning',
  high: 'border-destructive/25 bg-destructive/10 text-destructive',
  critical: 'border-destructive/40 bg-destructive/15 text-destructive',
}

function NotificationCard({ notification, timeZone, busy, onMarkRead, onDelete }) {
  const { lowPower } = useLowPower()
  const details = TYPE_DETAILS[notification.type]
  const Icon = details?.icon ?? Bell
  const createdLabel = formatTxnDate(notification.createdAt, { timeZone }) || 'Date unavailable'
  const severityClass = SEVERITY_STYLES[notification.severity] ?? 'border-border/70 bg-muted text-muted-foreground'
  const id = notification._id ?? notification.id

  return (
    <article
      aria-label={`${notification.isRead ? 'Read' : 'Unread'} notification: ${notification.title}`}
      className={`min-w-0 rounded-2xl border p-4 sm:p-5 ${lowPower ? 'glass-flat' : 'glass'} ${
        notification.isRead ? 'border-border/60' : 'border-primary/25'
      }`}
    >
      <div className="flex items-start gap-3">
        <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${
          notification.isRead ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'
        }`}>
          <Icon aria-hidden="true" className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className={`min-w-0 flex-1 text-sm ${notification.isRead ? 'font-medium' : 'font-semibold'}`}>
              {notification.title}
            </h2>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${severityClass}`}>
              {notification.severity}
            </span>
          </div>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{notification.message}</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
            <time dateTime={notification.createdAt}>{createdLabel}</time>
            {details && <span>{details.label}</span>}
            {!details && notification.type && <span>{notification.type.replaceAll('_', ' ')}</span>}
            {details && (
              <Link
                className="inline-flex min-h-8 items-center gap-1 font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                to={details.to}
              >
                View details <ArrowUpRight aria-hidden="true" className="size-3.5" />
              </Link>
            )}
          </div>
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        {!notification.isRead && (
          <Button
            aria-label={`Mark ${notification.title} as read`}
            disabled={busy}
            onClick={() => onMarkRead(id)}
            size="sm"
            variant="ghost"
          >
            <Check aria-hidden="true" />
            Mark read
          </Button>
        )}
        <Button
          aria-label={`Delete ${notification.title}`}
          disabled={busy}
          onClick={() => onDelete(id)}
          size="sm"
          variant="ghost"
        >
          <Trash2 aria-hidden="true" />
          Delete
        </Button>
      </div>
    </article>
  )
}

export default NotificationCard
