import { useMemo, useState } from 'react'
import { Check, Coins, Plus, Target, WalletCards } from 'lucide-react'
import { toast } from 'sonner'
import PageHeader from '@/components/common/PageHeader.jsx'
import EmptyState from '@/components/common/EmptyState.jsx'
import ErrorState from '@/components/common/ErrorState.jsx'
import GoalCard from '@/components/goals/GoalCard.jsx'
import GoalContributionForm from '@/components/goals/GoalContributionForm.jsx'
import GoalForm from '@/components/goals/GoalForm.jsx'
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog.jsx'
import { Button } from '@/components/ui/button.jsx'
import { useAuth } from '@/hooks/useAuth.js'
import { useGoalMutations } from '@/hooks/useGoalMutations.js'
import { useGoals } from '@/hooks/useGoals.js'
import { formatINR } from '@/lib/money.js'
import { todayInTimeZone } from '@/lib/goalDates.js'

function GoalMetric({ label, value, icon: Icon, tone }) {
  return (
    <article className="glass-flat flex min-w-0 items-center gap-3 rounded-2xl p-4">
      <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent/70 ${tone}`}><Icon aria-hidden="true" className="size-5" /></span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 truncate text-lg font-semibold tabular-nums">{value}</p>
      </div>
    </article>
  )
}

function Goals() {
  const { user } = useAuth()
  const timeZone = user?.timezone || 'Asia/Kolkata'
  const today = useMemo(() => todayInTimeZone(timeZone), [timeZone])
  const [formGoal, setFormGoal] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [contributionGoal, setContributionGoal] = useState(null)
  const [archivingGoal, setArchivingGoal] = useState(null)
  const { data, isPending, isError, refetch } = useGoals()
  const mutations = useGoalMutations()
  const summary = data?.summary
  const goals = data?.goals ?? []

  function openCreate() {
    setFormGoal(null)
    setFormOpen(true)
  }

  function archiveSelected() {
    if (!archivingGoal) return
    mutations.archive.mutate(archivingGoal.id ?? archivingGoal._id, {
      onSuccess: () => {
        toast.success('Goal archived')
        setArchivingGoal(null)
      },
    })
  }

  return (
    <>
      <PageHeader
        action={<Button className="min-h-10" onClick={openCreate}><Plus aria-hidden="true" />Create goal</Button>}
        description="Give your plans a target, a timeline, and a clear view of your progress."
        eyebrow="Save toward what matters"
        title="Savings Goals"
      />
      <div className="space-y-6">
        <section aria-label="Savings goals overview" className="glass-strong rounded-3xl p-5 sm:p-7">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Your savings plan</p>
            <h2 className="mt-2 text-xl font-bold sm:text-2xl">Small steps, visible progress</h2>
            <p className="mt-1 text-sm text-muted-foreground">Contributions update goal records only and do not transfer money between wallets.</p>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <GoalMetric icon={Target} label="Total goal targets" tone="text-primary" value={isPending || isError ? '—' : formatINR(summary?.totalTargetAmount ?? 0)} />
            <GoalMetric icon={Coins} label="Saved toward goals" tone="text-emerald-300" value={isPending || isError ? '—' : formatINR(summary?.totalSavedAmount ?? 0)} />
            <GoalMetric icon={Check} label="Goals completed" tone="text-sky-300" value={isPending || isError ? '—' : summary?.completedCount ?? 0} />
          </div>
        </section>

        <section aria-label="Savings goals">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Your goals</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {isPending ? 'Loading your goals…' : isError ? 'Goal status is unavailable.' : `${summary?.activeCount ?? 0} active · ${summary?.pausedCount ?? 0} paused · ${summary?.completedCount ?? 0} completed`}
            </p>
          </div>
          {isPending ? (
            <div aria-label="Loading savings goals" aria-busy="true" className="grid gap-4 md:grid-cols-2">
              {Array.from({ length: 3 }, (_, index) => <div className="glass-flat h-56 rounded-2xl animate-pulse" key={index} />)}
            </div>
          ) : isError ? (
            <ErrorState onRetry={() => refetch()} title="Could not load savings goals" />
          ) : goals.length === 0 ? (
            <EmptyState
              action={<Button onClick={openCreate}><Plus aria-hidden="true" />Create goal</Button>}
              description="Create a goal to track saved amounts, progress, and a target date. No money moves when you record a contribution."
              icon={WalletCards}
              title="No savings goals yet"
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {goals.map((goal) => (
                <GoalCard
                  archiving={mutations.archive.isPending}
                  changingStatus={mutations.pause.isPending || mutations.resume.isPending}
                  goal={goal}
                  key={goal.id ?? goal._id}
                  onArchive={setArchivingGoal}
                  onContribute={setContributionGoal}
                  onEdit={(selected) => {
                    setFormGoal(selected)
                    setFormOpen(true)
                  }}
                  onPause={(selected) => mutations.pause.mutate(selected.id ?? selected._id, {
                    onSuccess: () => toast.success('Goal paused'),
                  })}
                  onResume={(selected) => mutations.resume.mutate(selected.id ?? selected._id, {
                    onSuccess: () => toast.success('Goal resumed'),
                  })}
                />
              ))}
            </div>
          )}
        </section>
      </div>
      {formOpen && <GoalForm goal={formGoal} mutations={mutations} onClose={() => setFormOpen(false)} />}
      {contributionGoal && <GoalContributionForm goal={contributionGoal} mutations={mutations} onClose={() => setContributionGoal(null)} today={today} />}
      <AlertDialog onOpenChange={(open) => { if (!open && !mutations.archive.isPending) setArchivingGoal(null) }} open={Boolean(archivingGoal)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this savings goal?</AlertDialogTitle>
            <AlertDialogDescription>{archivingGoal && `“${archivingGoal.name}” will be hidden from your active goals. Its contribution history is preserved.`}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutations.archive.isPending}>Cancel</AlertDialogCancel>
            <Button disabled={mutations.archive.isPending} onClick={archiveSelected} variant="destructive">
              {mutations.archive.isPending ? 'Archiving…' : 'Archive goal'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export default Goals
