import { useMemo, useState } from 'react'
import { AlertTriangle, CalendarDays, CircleDollarSign, Plus, WalletCards } from 'lucide-react'
import { toast } from 'sonner'
import PageHeader from '@/components/common/PageHeader.jsx'
import EmptyState from '@/components/common/EmptyState.jsx'
import ErrorState from '@/components/common/ErrorState.jsx'
import BudgetCard from '@/components/budgets/BudgetCard.jsx'
import BudgetForm from '@/components/budgets/BudgetForm.jsx'
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog.jsx'
import { Button } from '@/components/ui/button.jsx'
import { useAuth } from '@/hooks/useAuth.js'
import { useBudgetMutations } from '@/hooks/useBudgetMutations.js'
import { useBudgets } from '@/hooks/useBudgets.js'
import { useCategories } from '@/hooks/useCategories.js'
import { useMotionDisabled } from '@/hooks/useMotionDisabled.js'
import { formatINR } from '@/lib/money.js'
import { budgetsForMonth, currentMonthInTimeZone, getBudgetTotals } from '@/lib/budgetHelpers.js'

function monthLabel(month) {
  const [year, value] = month.split('-').map(Number)
  return new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, value - 1, 1)))
}

function BudgetMetric({ label, value, icon: Icon, tone }) {
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

function Budgets() {
  const { user } = useAuth()
  const timeZone = user?.timezone || 'Asia/Kolkata'
  const [month, setMonth] = useState(() => currentMonthInTimeZone(timeZone))
  const [formBudget, setFormBudget] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [archivingBudget, setArchivingBudget] = useState(null)
  const { data, isPending, isError, refetch } = useBudgets()
  const { data: categories = [] } = useCategories('expense')
  const mutations = useBudgetMutations()
  const motionDisabled = useMotionDisabled()
  const budgets = useMemo(() => budgetsForMonth(data?.budgets ?? [], month), [data?.budgets, month])
  const totals = useMemo(() => getBudgetTotals(budgets), [budgets])

  function openCreate() {
    setFormBudget(null)
    setFormOpen(true)
  }

  function archiveSelected() {
    if (!archivingBudget) return
    mutations.archive.mutate(archivingBudget.id ?? archivingBudget._id, {
      onSuccess: () => {
        toast.success('Budget archived')
        setArchivingBudget(null)
      },
    })
  }

  return (
    <>
      <PageHeader
        action={<Button className="min-h-10" onClick={openCreate}><Plus aria-hidden="true" />Create budget</Button>}
        description="Set thoughtful limits and see how your spending tracks through each period."
        eyebrow="Plan with intention"
        title="Budgets"
      />
      <div className="space-y-6">
        <section aria-label="Budget overview" className="glass-strong overflow-hidden rounded-3xl p-5 sm:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Spending plan</p>
              <h2 className="mt-2 text-xl font-bold sm:text-2xl">{monthLabel(month)}</h2>
              <p className="mt-1 text-sm text-muted-foreground">Each card shows spending for its own date range. Overlapping limits can count the same expense more than once in these totals.</p>
            </div>
            <label className="flex items-center gap-2 text-sm font-medium">
              <CalendarDays aria-hidden="true" className="size-4 text-primary" />
              <span className="sr-only">Select budget month</span>
              <input aria-label="Select budget month" className="h-10 rounded-xl border border-border bg-background px-3 text-sm" onChange={(event) => setMonth(event.target.value)} type="month" value={month} />
            </label>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <BudgetMetric icon={WalletCards} label="Total allocated" tone="text-primary" value={isPending || isError ? '—' : formatINR(totals.allocated)} />
            <BudgetMetric icon={CircleDollarSign} label="Total spent" tone="text-sky-300" value={isPending || isError ? '—' : formatINR(totals.spent)} />
            <BudgetMetric icon={AlertTriangle} label="Remaining across budgets" tone={totals.remaining < 0 ? 'text-destructive' : 'text-emerald-300'} value={isPending || isError ? '—' : formatINR(totals.remaining)} />
          </div>
          {isError && <p className="mt-3 text-xs text-muted-foreground">Summary values are unavailable until budgets load.</p>}
        </section>

        <section aria-label={`${monthLabel(month)} budgets`}>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold">Your budget limits</h2>
              <p className="mt-1 text-sm text-muted-foreground">{budgets.length} {budgets.length === 1 ? 'budget' : 'budgets'} overlapping this month</p>
            </div>
          </div>
          {isPending ? (
            <div aria-label="Loading budgets" aria-busy="true" className="grid gap-4 md:grid-cols-2">
              {Array.from({ length: 4 }, (_, index) => <div className="glass-flat h-48 animate-pulse rounded-2xl" key={index} />)}
            </div>
          ) : isError ? (
            <ErrorState onRetry={() => refetch()} title="Could not load budgets" />
          ) : budgets.length === 0 ? (
            <EmptyState
              action={<Button onClick={openCreate}><Plus aria-hidden="true" />Create budget</Button>}
              description={`Create a spending limit for ${monthLabel(month)} or another period. Spending is calculated from confirmed, non-deleted expense transactions.`}
              icon={WalletCards}
              title="No budgets for this month"
            />
          ) : (
            <div className={`grid gap-4 md:grid-cols-2 ${motionDisabled ? '' : 'animate-in fade-in-0 duration-300'}`}>
              {budgets.map((budget) => (
                <BudgetCard
                  archiving={mutations.archive.isPending}
                  budget={budget}
                  categories={categories}
                  key={budget.id ?? budget._id}
                  onArchive={setArchivingBudget}
                  onEdit={(selected) => {
                    setFormBudget(selected)
                    setFormOpen(true)
                  }}
                />
              ))}
            </div>
          )}
        </section>
      </div>
      {formOpen && <BudgetForm budget={formBudget} month={month} mutations={mutations} onClose={() => setFormOpen(false)} />}
      <AlertDialog onOpenChange={(open) => { if (!open && !mutations.archive.isPending) setArchivingBudget(null) }} open={Boolean(archivingBudget)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this budget?</AlertDialogTitle>
            <AlertDialogDescription>{archivingBudget && `“${archivingBudget.name}” will be hidden from your active budgets. Its past records are preserved.`}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutations.archive.isPending}>Cancel</AlertDialogCancel>
            <Button disabled={mutations.archive.isPending} onClick={archiveSelected} variant="destructive">
              {mutations.archive.isPending ? 'Archiving…' : 'Archive budget'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export default Budgets
