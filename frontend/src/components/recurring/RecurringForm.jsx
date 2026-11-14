import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/errors.js'
import { useCategories } from '@/hooks/useCategories.js'
import { useWallets } from '@/hooks/useWallets.js'
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
import {
  initialRecurringValues,
  recurringFormSchema,
  recurringId,
  recurringPayload,
} from '@/lib/recurringForm.js'

const typeOptions = [['expense', 'Expense'], ['income', 'Income']]
const frequencyOptions = [
  ['daily', 'Every day'],
  ['weekly', 'Every week'],
  ['monthly', 'Every month'],
  ['yearly', 'Every year'],
]

function RecurringForm({ schedule, mutations, today, onClose }) {
  const editing = Boolean(schedule)
  const [submitError, setSubmitError] = useState('')
  const previousType = useRef(schedule?.type ?? 'expense')
  const { data: walletData, isLoading: walletsLoading, isError: walletsError, refetch: refetchWallets } = useWallets()
  const wallets = walletData?.wallets ?? []
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(recurringFormSchema),
    defaultValues: initialRecurringValues(schedule, today),
  })
  const type = watch('type')
  const { data: categories = [], isLoading: categoriesLoading, isError: categoriesError, refetch: refetchCategories } = useCategories(type)

  useEffect(() => {
    if (previousType.current !== type) {
      setValue('categoryId', '', { shouldDirty: true })
      previousType.current = type
    }
  }, [setValue, type])

  async function submit(values) {
    setSubmitError('')
    const payload = recurringPayload(values, schedule)
    if (editing && Object.keys(payload).length === 0) {
      onClose()
      return
    }
    try {
      if (editing) {
        await mutations.update.mutateAsync({ id: recurringId(schedule), payload })
        toast.success('Recurring schedule updated')
      } else {
        await mutations.create.mutateAsync(payload)
        toast.success('Recurring schedule created')
      }
      onClose()
    } catch (error) {
      setSubmitError(getErrorMessage(error, 'Could not save this recurring schedule. Please try again.'))
    }
  }

  const busy = isSubmitting || mutations.create.isPending || mutations.update.isPending
  const selectedWallet = schedule?.walletId
  const selectedWalletId = selectedWallet?.id ?? selectedWallet?._id ?? selectedWallet
  const walletAvailable = wallets.some((wallet) => (wallet.id ?? wallet._id) === selectedWalletId)
  const selectedCategory = schedule?.categoryId
  const selectedCategoryId = selectedCategory?.id ?? selectedCategory?._id ?? selectedCategory
  const categoryAvailable = categories.some((category) => (category.id ?? category._id) === selectedCategoryId)
  const canSubmit = !walletsLoading && !walletsError && wallets.length > 0

  return (
    <Dialog onOpenChange={(open) => { if (!open) onClose() }} open>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit recurring schedule' : 'Add recurring schedule'}</DialogTitle>
          <DialogDescription>A schedule is converted into a confirmed transaction when its due date is processed.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit(submit)}>
          {submitError && <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive" role="alert">{submitError}</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="recurring-name">Schedule name</Label>
              <Input aria-invalid={Boolean(errors.name)} autoFocus id="recurring-name" maxLength={80} {...register('name')} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="recurring-amount">Amount (₹)</Label>
              <Input aria-invalid={Boolean(errors.amount)} id="recurring-amount" inputMode="decimal" placeholder="1250.00" {...register('amount')} />
              {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="recurring-type">Type</Label>
              <select className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" id="recurring-type" {...register('type')}>
                {typeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="recurring-frequency">Frequency</Label>
              <select className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" id="recurring-frequency" {...register('frequency')}>
                {frequencyOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="recurring-wallet">Wallet</Label>
              <select aria-invalid={Boolean(errors.walletId)} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" disabled={walletsLoading || walletsError} id="recurring-wallet" {...register('walletId')}>
                <option value="">Choose a wallet</option>
                {editing && selectedWalletId && !walletAvailable && (
                  <option value={selectedWalletId}>{selectedWallet?.name ?? 'Existing wallet (unavailable)'}</option>
                )}
                {wallets.map((wallet) => <option key={wallet.id ?? wallet._id} value={wallet.id ?? wallet._id}>{wallet.name}</option>)}
              </select>
              {errors.walletId && <p className="text-xs text-destructive">{errors.walletId.message}</p>}
              {walletsLoading && <p className="text-xs text-muted-foreground" role="status">Loading wallets…</p>}
              {walletsError && (
                <p className="text-xs text-destructive" role="alert">
                  Couldn’t load wallets. <button className="underline" onClick={() => refetchWallets()} type="button">Retry</button>
                </p>
              )}
              {!walletsLoading && !walletsError && wallets.length === 0 && <p className="text-xs text-destructive">Add an active wallet before creating a schedule.</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="recurring-category">Category (optional)</Label>
              <select className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" disabled={categoriesLoading || categoriesError} id="recurring-category" {...register('categoryId')}>
                <option value="">No category</option>
                {editing && selectedCategoryId && !categoryAvailable && (
                  <option value={selectedCategoryId}>{selectedCategory?.name ?? 'Existing category'}</option>
                )}
                {categories.map((category) => <option key={category.id ?? category._id} value={category.id ?? category._id}>{category.icon} {category.name}</option>)}
              </select>
              {categoriesLoading && <p className="text-xs text-muted-foreground" role="status">Loading categories…</p>}
              {categoriesError && (
                <p className="text-xs text-destructive" role="alert">
                  Couldn’t load categories. <button className="underline" onClick={() => refetchCategories()} type="button">Retry</button>
                </p>
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="recurring-description">Description (optional)</Label>
            <textarea aria-invalid={Boolean(errors.description)} className="min-h-20 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" id="recurring-description" maxLength={300} {...register('description')} />
            {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="recurring-start-date">First due date</Label>
              <Input aria-invalid={Boolean(errors.startDate)} id="recurring-start-date" type="date" {...register('startDate')} />
              {errors.startDate && <p className="text-xs text-destructive">{errors.startDate.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="recurring-end-date">End date (optional)</Label>
              <Input aria-invalid={Boolean(errors.endDate)} id="recurring-end-date" type="date" {...register('endDate')} />
              {errors.endDate && <p className="text-xs text-destructive">{errors.endDate.message}</p>}
            </div>
          </div>
          <p className="rounded-xl bg-accent/50 px-3 py-2 text-xs text-muted-foreground">
            {editing
              ? 'Changes to frequency or first due date recalculate the next scheduled date on the server.'
              : 'The first transaction is scheduled for the first due date. Later dates are calculated by the server.'}
          </p>
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button onClick={onClose} type="button" variant="outline">Cancel</Button>
            <Button disabled={busy || !canSubmit || categoriesLoading} type="submit">
              {busy ? 'Saving…' : editing ? 'Save changes' : 'Create schedule'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default RecurringForm
