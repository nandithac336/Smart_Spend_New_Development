import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/errors.js'
import { Input } from '@/components/ui/input.jsx'
import { Label } from '@/components/ui/label.jsx'
import { Button } from '@/components/ui/button.jsx'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.jsx'
import { goalFormSchema, goalPayload, initialGoalFormValues } from '@/lib/goalForm.js'

function GoalForm({ goal, mutations, onClose }) {
  const editing = Boolean(goal)
  const [submitError, setSubmitError] = useState('')
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(goalFormSchema(goal?.savedAmount ?? 0)),
    defaultValues: initialGoalFormValues(goal),
  })

  async function submit(values) {
    setSubmitError('')
    const payload = goalPayload(values)
    try {
      if (editing) {
        await mutations.update.mutateAsync({ id: goal.id ?? goal._id, payload })
        toast.success('Savings goal updated')
      } else {
        await mutations.create.mutateAsync(payload)
        toast.success('Savings goal created')
      }
      onClose()
    } catch (error) {
      setSubmitError(getErrorMessage(error, 'Could not save this goal. Please try again.'))
    }
  }

  return (
    <Dialog onOpenChange={(open) => { if (!open) onClose() }} open>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit savings goal' : 'Create savings goal'}</DialogTitle>
          <DialogDescription>Set a target and date to track your progress over time.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit(submit)}>
          {submitError && <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive" role="alert">{submitError}</p>}
          <div className="space-y-1.5">
            <Label htmlFor="goal-name">Goal name</Label>
            <Input aria-invalid={Boolean(errors.name)} autoFocus id="goal-name" maxLength={80} {...register('name')} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="goal-description">Description (optional)</Label>
            <textarea aria-invalid={Boolean(errors.description)} className="min-h-20 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" id="goal-description" maxLength={500} {...register('description')} />
            {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="goal-target">Target amount (₹)</Label>
              <Input aria-invalid={Boolean(errors.targetAmount)} id="goal-target" inputMode="decimal" placeholder="50000.00" {...register('targetAmount')} />
              {errors.targetAmount && <p className="text-xs text-destructive">{errors.targetAmount.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="goal-date">Target date</Label>
              <Input aria-invalid={Boolean(errors.targetDate)} id="goal-date" type="date" {...register('targetDate')} />
              {errors.targetDate && <p className="text-xs text-destructive">{errors.targetDate.message}</p>}
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button onClick={onClose} type="button" variant="outline">Cancel</Button>
            <Button disabled={isSubmitting || mutations.create.isPending || mutations.update.isPending} type="submit">
              {isSubmitting || mutations.create.isPending || mutations.update.isPending
                ? 'Saving…'
                : editing ? 'Save changes' : 'Create goal'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default GoalForm
