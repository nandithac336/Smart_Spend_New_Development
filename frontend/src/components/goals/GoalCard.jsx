import { CalendarDays, Check, CirclePause, CirclePlay, Pencil, Plus, Target, Trash2 } from 'lucide-react'
import { formatINR } from '@/lib/money.js'
import { goalDateLabel } from '@/lib/goalDates.js'
import { Button } from '@/components/ui/button.jsx'

const stateLabels = { active: 'In progress', completed: 'Completed', paused: 'Paused' }

function GoalCard({ goal, onEdit, onContribute, onArchive, onPause, onResume, archiving, changingStatus }) {
  const progress = goal.progress ?? {}
  const percentage = Math.max(0, Math.min(100, Number(progress.percentageComplete) || 0))
  const completed = goal.status === 'completed' || progress.isCompleted
  const paused = goal.status === 'paused'

  return (
    <article className="glass-flat min-w-0 overflow-hidden rounded-2xl p-4 sm:p-5">
      <header className="flex items-start gap-3">
        <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${completed ? 'bg-emerald-400/10 text-emerald-300' : 'bg-primary/10 text-primary'}`}>
          {completed ? <Check aria-hidden="true" className="size-5" /> : <Target aria-hidden="true" className="size-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate font-semibold">{goal.name}</h2>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${completed ? 'bg-emerald-400/10 text-emerald-300' : paused ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'}`}>
              {stateLabels[completed ? 'completed' : goal.status] ?? goal.status}
            </span>
          </div>
          {goal.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{goal.description}</p>}
        </div>
        <Button aria-label={`Edit ${goal.name}`} onClick={() => onEdit(goal)} size="icon-sm" variant="ghost"><Pencil aria-hidden="true" /></Button>
      </header>
      <div className="mt-5 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">Saved toward goal</p>
          <p className="mt-1 text-xl font-bold tabular-nums">{formatINR(progress.savedAmount ?? goal.savedAmount)}</p>
        </div>
        <p className="text-right text-xs text-muted-foreground">
          target <span className="font-semibold text-foreground">{formatINR(progress.targetAmount ?? goal.targetAmount)}</span>
        </p>
      </div>
      <div
        aria-label={`${Math.round(percentage)}% complete`}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={Math.round(percentage)}
        className="mt-3 h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
      >
        <div className={`h-full rounded-full bg-gradient-to-r ${completed ? 'from-emerald-400 to-teal-300' : 'from-primary to-sky-400'} transition-[width] duration-500`} style={{ width: `${percentage}%` }} />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{percentage.toFixed(percentage % 1 ? 1 : 0)}% complete</span>
        <span className="inline-flex items-center gap-1"><CalendarDays aria-hidden="true" className="size-3.5" />By {goalDateLabel(goal.targetDate)}</span>
      </div>
      {!completed && !paused && progress.requiredMonthlySavings > 0 && (
        <p className="mt-3 rounded-xl bg-accent/50 px-3 py-2 text-xs text-muted-foreground">
          Suggested monthly pace: <span className="font-semibold text-foreground">{formatINR(progress.requiredMonthlySavings)}</span>
        </p>
      )}
      <footer className="mt-4 flex flex-wrap gap-2 border-t border-border/70 pt-3">
        {!completed && !paused && (
          <Button className="flex-1" onClick={() => onContribute(goal)} size="sm"><Plus aria-hidden="true" />Add money</Button>
        )}
        {paused && (
          <Button className="flex-1" disabled={changingStatus} onClick={() => onResume(goal)} size="sm" variant="outline"><CirclePlay aria-hidden="true" />Resume</Button>
        )}
        {!completed && !paused && (
          <Button aria-label={`Pause ${goal.name}`} disabled={changingStatus} onClick={() => onPause(goal)} size="icon" variant="outline"><CirclePause aria-hidden="true" /></Button>
        )}
        {completed && <span className="inline-flex flex-1 items-center gap-2 text-sm font-medium text-emerald-300"><Check aria-hidden="true" className="size-4" />Goal reached</span>}
        <Button aria-label={`Archive ${goal.name}`} disabled={archiving} onClick={() => onArchive(goal)} size="icon" variant="ghost"><Trash2 aria-hidden="true" /></Button>
      </footer>
    </article>
  )
}

export default GoalCard
