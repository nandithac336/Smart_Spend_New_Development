import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { toast } from 'sonner'
import { formatINR, toPaise } from '@/lib/money.js'
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
import { contributionPayload } from '@/lib/goalForm.js'
import { validCalendarDate } from '@/lib/budgetHelpers.js'

const amountPattern = /^\d+(?:\.\d{1,2})?$/

function contributionSchema(remainingAmount) {
  return z.object({
    amount: z.string().trim().regex(amountPattern, 'Enter an amount with up to 2 decimal places')
      .refine((value) => {
        const amount = toPaise(value)
        return amount !== null && amount > 0 && amount <= remainingAmount
      }, 'Enter an amount up to the remaining target'),
    contributionDate: z.string().refine(validCalendarDate, 'Choose a valid date'),
    note: z.string().max(300, 'Note must be 300 characters or fewer'),
  })
}

function GoalContributionForm({ goal, mutations, today, onClose }) {
  const [submitError, setSubmitError] = useState('')
  const remainingAmount = goal.progress?.remainingAmount ?? Math.max(0, goal.targetAmount - goal.savedAmount)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(contributionSchema(remainingAmount)),
    defaultValues: { amount: '', contributionDate: today, note: '' },
  })

  async function submit(values) {
    setSubmitError('')
    try {
      await mutations.contribute.mutateAsync({
        id: goal.id ?? goal._id,
        payload: contributionPayload(values),
      })
      toast.success('Contribution recorded')
      onClose()
    } catch (error) {
      setSubmitError(getErrorMessage(error, 'Could not record this contribution. Please try again.'))
    }
  }

  return (
    <Dialog onOpenChange={(open) => { if (!open) onClose() }} open>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record contribution</DialogTitle>
          <DialogDescription>
            Add savings recorded toward “{goal.name}”. This updates the goal ledger only; it does not move money between wallets.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit(submit)}>
          {submitError && <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive" role="alert">{submitError}</p>}
          <p className="rounded-xl bg-accent/60 p-3 text-sm text-muted-foreground">
            Remaining target: <span className="font-semibold text-foreground">{formatINR(remainingAmount, { minimumFractionDigits: 2 })}</span>
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="goal-contribution-amount">Contribution amount (₹)</Label>
            <Input aria-invalid={Boolean(errors.amount)} id="goal-contribution-amount" inputMode="decimal" placeholder="2500.00" {...register('amount')} />
            {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="goal-contribution-date">Date</Label>
            <Input aria-invalid={Boolean(errors.contributionDate)} id="goal-contribution-date" type="date" {...register('contributionDate')} />
            {errors.contributionDate && <p className="text-xs text-destructive">{errors.contributionDate.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="goal-contribution-note">Note (optional)</Label>
            <Input id="goal-contribution-note" maxLength={300} {...register('note')} />
            {errors.note && <p className="text-xs text-destructive">{errors.note.message}</p>}
          </div>
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button onClick={onClose} type="button" variant="outline">Cancel</Button>
            <Button disabled={isSubmitting || mutations.contribute.isPending} type="submit">
              {isSubmitting || mutations.contribute.isPending ? 'Recording…' : 'Record contribution'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default GoalContributionForm
