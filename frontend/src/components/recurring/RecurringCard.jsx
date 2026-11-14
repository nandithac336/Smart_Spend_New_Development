import { CalendarClock, CirclePause, CirclePlay, Clock3, Pencil, ReceiptText, Trash2 } from 'lucide-react'
import { formatINR } from '@/lib/money.js'
import { Button } from '@/components/ui/button.jsx'
import { formatScheduleDate } from '@/lib/recurringDates.js'

const frequencyNames = {
  daily: 'Every day',
  weekly: 'Every week',
  monthly: 'Every month',
  yearly: 'Every year',
}
const statusNames = {
  active: 'Active',
  paused: 'Paused',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

function RecurringCard({
  schedule,
  today,
  onEdit,
  onPause,
  onResume,
  onCancel,
  onHistory,
  busy,
}) {
  const active = schedule.status === 'active'
  const paused = schedule.status === 'paused'
  const editable = active || paused
  const dueDate = schedule.status === 'completed'
    ? schedule.endDate ?? schedule.nextDueDate
    : schedule.nextDueDate
  const dueNow = active && dueDate && new Date(dueDate).toISOString().slice(0, 10) <= today
  const category = schedule.categoryId
  const wallet = schedule.walletId

  return (
    <article className="glass-flat min-w-0 rounded-2xl p-4 sm:p-5">
      <header className="flex items-start gap-3">
        <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${schedule.type === 'income' ? 'bg-emerald-400/10 text-emerald-300' : 'bg-primary/10 text-primary'}`}>
          <CalendarClock aria-hidden="true" className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-semibold">{schedule.name}</h3>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${active ? 'bg-emerald-400/10 text-emerald-300' : paused ? 'bg-amber-400/10 text-amber-300' : 'bg-muted text-muted-foreground'}`}>
              {statusNames[schedule.status] ?? schedule.status}
            </span>
          </div>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {schedule.type === 'income' ? 'Income' : 'Expense'} · {frequencyNames[schedule.frequency] ?? schedule.frequency}
          </p>
        </div>
        {editable && <Button aria-label={`Edit ${schedule.name}`} onClick={() => onEdit(schedule)} size="icon-sm" variant="ghost"><Pencil aria-hidden="true" /></Button>}
      </header>
      <div className="mt-5 flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">Scheduled amount</span>
        <span className={`text-xl font-bold tabular-nums ${schedule.type === 'income' ? 'text-emerald-300' : ''}`}>
          {schedule.type === 'expense' ? '−' : '+'}{formatINR(schedule.amount)}
        </span>
      </div>
      <div className="mt-3 space-y-2 border-t border-border/70 pt-3 text-xs">
        <p className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <Clock3 aria-hidden="true" className="size-3.5" />
            {schedule.status === 'completed' ? 'Completed through' : 'Next due'}
          </span>
          <span className={`font-medium ${dueNow ? 'text-amber-300' : ''}`}>
            {dueDate ? formatScheduleDate(dueDate) : 'Not scheduled'}
            {dueNow && ' · due'}
          </span>
        </p>
        <p className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Category · wallet</span>
          <span className="truncate text-right font-medium">{category?.name || 'Uncategorized'} · {wallet?.name || 'Wallet unavailable'}</span>
        </p>
        {schedule.description && <p className="line-clamp-2 text-muted-foreground">{schedule.description}</p>}
      </div>
      <footer className="mt-4 flex flex-wrap gap-2 border-t border-border/70 pt-3">
        <Button className="flex-1" onClick={() => onHistory(schedule)} size="sm" variant="outline"><ReceiptText aria-hidden="true" />Created history</Button>
        {active && <Button aria-label={`Pause ${schedule.name}`} disabled={busy} onClick={() => onPause(schedule)} size="icon" variant="outline"><CirclePause aria-hidden="true" /></Button>}
        {paused && <Button aria-label={`Resume ${schedule.name}`} disabled={busy} onClick={() => onResume(schedule)} size="icon" variant="outline"><CirclePlay aria-hidden="true" /></Button>}
        {editable && <Button aria-label={`Cancel ${schedule.name}`} disabled={busy} onClick={() => onCancel(schedule)} size="icon" variant="ghost"><Trash2 aria-hidden="true" /></Button>}
      </footer>
    </article>
  )
}

export default RecurringCard
