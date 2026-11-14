import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/errors.js'
import { toPaise } from '@/lib/money.js'
import { useCategories } from '@/hooks/useCategories.js'
import { Button } from '@/components/ui/button.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Label } from '@/components/ui/label.jsx'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.jsx'
import { budgetFormSchema, initialBudgetFormValues } from '@/lib/budgetForm.js'
import { makeBudgetPayload } from '@/lib/budgetHelpers.js'

const periods = [
  ['monthly', 'Monthly'],
  ['weekly', 'Weekly'],
  ['yearly', 'Yearly'],
  ['custom', 'Custom dates'],
]

function BudgetForm({ budget, month, mutations, onClose }) {
  const editing = Boolean(budget)
  const [submitError, setSubmitError] = useState('')
  const { data: categories = [], isLoading: categoriesLoading, isError: categoriesError, refetch } = useCategories('expense')
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(budgetFormSchema),
    defaultValues: initialBudgetFormValues(budget, month),
  })
  const period = watch('period')

  async function submit(values) {
    setSubmitError('')
    const payload = makeBudgetPayload(values, toPaise)
    try {
      if (editing) {
        await mutations.update.mutateAsync({ id: budget.id ?? budget._id, payload })
        toast.success('Budget updated')
      } else {
        await mutations.create.mutateAsync(payload)
        toast.success('Budget created')
      }
      onClose()
    } catch (error) {
      setSubmitError(getErrorMessage(error, 'Could not save this budget. Please try again.'))
    }
  }

  return (
    <Dialog onOpenChange={(open) => { if (!open) onClose() }} open>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit budget' : 'Create budget'}</DialogTitle>
          <DialogDescription>Set a spending limit for an expense category and period.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit(submit)}>
          {submitError && <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive" role="alert">{submitError}</p>}
          <div className="space-y-1.5">
            <Label htmlFor="budget-name">Budget name</Label>
            <Input aria-invalid={Boolean(errors.name)} autoFocus id="budget-name" maxLength={60} {...register('name')} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="budget-amount">Limit (₹)</Label>
            <Input aria-invalid={Boolean(errors.amount)} id="budget-amount" inputMode="decimal" placeholder="5000.00" {...register('amount')} />
            {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="budget-category">Expense category</Label>
            <select className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" disabled={categoriesLoading || categoriesError} id="budget-category" {...register('categoryId')}>
              <option value="">All expense categories</option>
              {categories.map((category) => <option key={category.id ?? category._id} value={category.id ?? category._id}>{category.icon} {category.name}</option>)}
            </select>
            {categoriesLoading && <p className="text-xs text-muted-foreground" role="status">Loading categories…</p>}
            {categoriesError && (
              <p className="text-xs text-destructive" role="alert">
                Couldn’t load categories. <button className="underline" onClick={() => refetch()} type="button">Retry</button>
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="budget-period">Budget period</Label>
            <select className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" id="budget-period" {...register('period')}>
              {periods.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          {period === 'monthly' && (
            <div className="space-y-1.5">
              <Label htmlFor="budget-month">Month</Label>
              <Input aria-invalid={Boolean(errors.month)} id="budget-month" type="month" {...register('month')} />
              {errors.month && <p className="text-xs text-destructive">{errors.month.message}</p>}
            </div>
          )}
          {period === 'weekly' && (
            <div className="space-y-1.5">
              <Label htmlFor="budget-week-start">Week starting Monday</Label>
              <Input aria-invalid={Boolean(errors.weekStart)} id="budget-week-start" type="date" {...register('weekStart')} />
              {errors.weekStart && <p className="text-xs text-destructive">{errors.weekStart.message}</p>}
            </div>
          )}
          {period === 'yearly' && (
            <div className="space-y-1.5">
              <Label htmlFor="budget-year">Calendar year</Label>
              <Input aria-invalid={Boolean(errors.year)} id="budget-year" inputMode="numeric" maxLength={4} {...register('year')} />
              {errors.year && <p className="text-xs text-destructive">{errors.year.message}</p>}
            </div>
          )}
          {period === 'custom' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="budget-custom-start">Start date</Label>
                <Input aria-invalid={Boolean(errors.customStart)} id="budget-custom-start" type="date" {...register('customStart')} />
                {errors.customStart && <p className="text-xs text-destructive">{errors.customStart.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="budget-custom-end">End date</Label>
                <Input aria-invalid={Boolean(errors.customEnd)} id="budget-custom-end" type="date" {...register('customEnd')} />
                {errors.customEnd && <p className="text-xs text-destructive">{errors.customEnd.message}</p>}
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button onClick={onClose} type="button" variant="outline">Cancel</Button>
            <Button disabled={isSubmitting || mutations.create.isPending || mutations.update.isPending || categoriesLoading || categoriesError} type="submit">
              {isSubmitting || mutations.create.isPending || mutations.update.isPending
                ? 'Saving…'
                : editing ? 'Save changes' : 'Create budget'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default BudgetForm
