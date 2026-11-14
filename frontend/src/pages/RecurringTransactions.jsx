import { useMemo, useState } from 'react'
import { CalendarClock, CirclePause, CirclePlay, Plus, Repeat2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import PageHeader from '@/components/common/PageHeader.jsx'
import EmptyState from '@/components/common/EmptyState.jsx'
import ErrorState from '@/components/common/ErrorState.jsx'
import RecurringCard from '@/components/recurring/RecurringCard.jsx'
import RecurringForm from '@/components/recurring/RecurringForm.jsx'
import RecurringHistoryDialog from '@/components/recurring/RecurringHistoryDialog.jsx'
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog.jsx'
import { Button } from '@/components/ui/button.jsx'
import { useAuth } from '@/hooks/useAuth.js'
import { useRecurringHistory } from '@/hooks/useRecurringHistory.js'
import { useRecurringMutations } from '@/hooks/useRecurringMutations.js'
import { useRecurringTransactions } from '@/hooks/useRecurringTransactions.js'
import { todayInTimeZone } from '@/lib/recurringDates.js'

function ScheduleSection({ title, icon: Icon, schedules, today, onEdit, onPause, onResume, onCancel, onHistory, busy }) {
  return (
    <section aria-label={title} className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold"><Icon aria-hidden="true" className="size-4 text-primary" />{title}</h2>
        <span className="rounded-full bg-accent/70 px-2.5 py-1 text-xs font-medium text-muted-foreground">{schedules.length}</span>
      </div>
      {schedules.length === 0 ? (
        <p className="glass-flat rounded-2xl px-4 py-5 text-sm text-muted-foreground">No schedules in this group.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {schedules.map((schedule) => (
            <RecurringCard
              busy={busy}
              key={schedule.id ?? schedule._id}
              onCancel={onCancel}
              onEdit={onEdit}
              onHistory={onHistory}
              onPause={onPause}
              onResume={onResume}
              schedule={schedule}
              today={today}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function RecurringTransactions() {
  const { user } = useAuth()
  const timeZone = user?.timezone || 'Asia/Kolkata'
  const today = useMemo(() => todayInTimeZone(timeZone), [timeZone])
  const [formSchedule, setFormSchedule] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [cancelSchedule, setCancelSchedule] = useState(null)
  const [historySchedule, setHistorySchedule] = useState(null)
  const { data: schedules = [], isPending, isError, refetch } = useRecurringTransactions()
  const mutations = useRecurringMutations()
  const historyQuery = useRecurringHistory(
    historySchedule?.id ?? historySchedule?._id,
    Boolean(historySchedule),
  )
  const active = schedules.filter((item) => item.status === 'active')
  const paused = schedules.filter((item) => item.status === 'paused')
  const ended = schedules.filter((item) => ['completed', 'cancelled'].includes(item.status))
  const showEmpty = !isPending && !isError && schedules.length === 0
  const busy = mutations.pause.isPending || mutations.resume.isPending || mutations.cancel.isPending

  function openCreate() {
    setFormSchedule(null)
    setFormOpen(true)
  }

  function changeStatus(action, schedule, message) {
    action.mutate(schedule.id ?? schedule._id, {
      onSuccess: () => toast.success(message),
    })
  }

  function cancelSelectedSchedule() {
    if (!cancelSchedule) return
    changeStatus(mutations.cancel, cancelSchedule, 'Recurring schedule cancelled')
    setCancelSchedule(null)
  }

  return (
    <>
      <PageHeader
        action={<Button className="min-h-10" onClick={openCreate}><Plus aria-hidden="true" />Add schedule</Button>}
        description="Plan income and expenses that repeat, with a clear view of what is scheduled and what has already been created."
        eyebrow="Stay ahead of what repeats"
        title="Recurring Transactions"
      />
      <div className="space-y-6">
        <section aria-label="How recurring schedules work" className="glass-strong flex items-start gap-3 rounded-2xl p-4 sm:p-5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Sparkles aria-hidden="true" className="size-5" /></span>
          <div>
            <h2 className="text-sm font-semibold">Schedules and transactions are different</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              A schedule is a plan. The backend job processes due schedules and creates a confirmed transaction; use “Created history” on a schedule to review those transactions. Creating a schedule does not create a transaction immediately.
            </p>
          </div>
        </section>

        <section aria-label="Recurring schedule summary" className="grid gap-3 sm:grid-cols-3">
          <article className="glass-flat flex items-center gap-3 rounded-2xl p-4">
            <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300"><CalendarClock aria-hidden="true" className="size-5" /></span>
            <div><p className="text-xs text-muted-foreground">Active</p><p className="text-lg font-semibold">{isPending || isError ? '—' : active.length}</p></div>
          </article>
          <article className="glass-flat flex items-center gap-3 rounded-2xl p-4">
            <span className="flex size-10 items-center justify-center rounded-xl bg-amber-400/10 text-amber-300"><CirclePause aria-hidden="true" className="size-5" /></span>
            <div><p className="text-xs text-muted-foreground">Paused</p><p className="text-lg font-semibold">{isPending || isError ? '—' : paused.length}</p></div>
          </article>
          <article className="glass-flat flex items-center gap-3 rounded-2xl p-4">
            <span className="flex size-10 items-center justify-center rounded-xl bg-accent/70 text-primary"><Repeat2 aria-hidden="true" className="size-5" /></span>
            <div><p className="text-xs text-muted-foreground">Schedules total</p><p className="text-lg font-semibold">{isPending || isError ? '—' : schedules.length}</p></div>
          </article>
        </section>

        {isPending ? (
          <div aria-label="Loading recurring schedules" aria-busy="true" className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }, (_, index) => <div className="glass-flat h-56 animate-pulse rounded-2xl" key={index} />)}
          </div>
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} title="Could not load recurring schedules" />
        ) : showEmpty ? (
          <EmptyState
            action={<Button onClick={openCreate}><Plus aria-hidden="true" />Add schedule</Button>}
            description="Create a recurring schedule to plan future income or expenses. The schedule will appear here separately from transactions it generates."
            icon={Repeat2}
            title="No recurring schedules yet"
          />
        ) : (
          <>
            <ScheduleSection
              busy={busy}
              icon={CalendarClock}
              onCancel={setCancelSchedule}
              onEdit={(schedule) => { setFormSchedule(schedule); setFormOpen(true) }}
              onHistory={setHistorySchedule}
              onPause={(schedule) => changeStatus(mutations.pause, schedule, 'Schedule paused')}
              onResume={(schedule) => changeStatus(mutations.resume, schedule, 'Schedule resumed')}
              schedules={active}
              title="Active schedules"
              today={today}
            />
            <ScheduleSection
              busy={busy}
              icon={CirclePause}
              onCancel={setCancelSchedule}
              onEdit={(schedule) => { setFormSchedule(schedule); setFormOpen(true) }}
              onHistory={setHistorySchedule}
              onPause={(schedule) => changeStatus(mutations.pause, schedule, 'Schedule paused')}
              onResume={(schedule) => changeStatus(mutations.resume, schedule, 'Schedule resumed')}
              schedules={paused}
              title="Paused schedules"
              today={today}
            />
            {ended.length > 0 && (
              <ScheduleSection
                busy={busy}
                icon={CirclePlay}
                onCancel={setCancelSchedule}
                onEdit={(schedule) => { setFormSchedule(schedule); setFormOpen(true) }}
                onHistory={setHistorySchedule}
                onPause={(schedule) => changeStatus(mutations.pause, schedule, 'Schedule paused')}
                onResume={(schedule) => changeStatus(mutations.resume, schedule, 'Schedule resumed')}
                schedules={ended}
                title="Completed and cancelled"
                today={today}
              />
            )}
          </>
        )}
      </div>
      {formOpen && <RecurringForm schedule={formSchedule} mutations={mutations} onClose={() => setFormOpen(false)} today={today} />}
      {historySchedule && (
        <RecurringHistoryDialog
          onClose={() => setHistorySchedule(null)}
          query={historyQuery}
          schedule={historySchedule}
          timeZone={timeZone}
        />
      )}
      <AlertDialog onOpenChange={(open) => { if (!open && !mutations.cancel.isPending) setCancelSchedule(null) }} open={Boolean(cancelSchedule)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this recurring schedule?</AlertDialogTitle>
            <AlertDialogDescription>
              {cancelSchedule && `“${cancelSchedule.name}” will stop being scheduled. Previously generated transactions remain in your transaction history.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutations.cancel.isPending}>Keep schedule</AlertDialogCancel>
            <Button disabled={mutations.cancel.isPending} onClick={cancelSelectedSchedule} variant="destructive">
              {mutations.cancel.isPending ? 'Cancelling…' : 'Cancel schedule'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export default RecurringTransactions
