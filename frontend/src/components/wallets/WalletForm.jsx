import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { toPaise, fromPaise } from '@/lib/money.js'
import { getErrorMessage } from '@/lib/errors.js'
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

const walletTypes = [
  ['cash', 'Cash'],
  ['bank', 'Bank'],
  ['upi', 'UPI'],
  ['card', 'Card'],
]
const amountPattern = /^\d+(?:\.\d{1,2})?$/

const walletSchema = z.object({
  name: z.string().trim().min(1, 'Enter a wallet name').max(40, 'Wallet name must be 40 characters or fewer'),
  type: z.enum(['cash', 'bank', 'upi', 'card']),
  openingBalance: z.string().trim().regex(amountPattern, 'Enter an amount with up to 2 decimal places')
    .refine((value) => {
      const amount = toPaise(value)
      return amount !== null && amount >= 0 && amount <= 10_000_000_000
    }, 'Opening balance must be within the allowed limit'),
})

function walletId(wallet) {
  return wallet.id ?? wallet._id
}

function WalletForm({ wallet, mutations, onClose }) {
  const editing = Boolean(wallet)
  const [submitError, setSubmitError] = useState('')
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(walletSchema),
    defaultValues: {
      name: wallet?.name ?? '',
      type: wallet?.type ?? 'cash',
      openingBalance: wallet ? fromPaise(wallet.openingBalance ?? 0).toFixed(2) : '0',
    },
  })

  async function submit(values) {
    setSubmitError('')
    const payload = {
      name: values.name.trim(),
      type: values.type,
      openingBalance: toPaise(values.openingBalance),
    }
    try {
      if (editing) {
        await mutations.update.mutateAsync({ id: walletId(wallet), payload })
      } else {
        await mutations.create.mutateAsync(payload)
      }
      onClose()
    } catch (error) {
      setSubmitError(getErrorMessage(error, 'Could not save this wallet. Please try again.'))
    }
  }

  return (
    <Dialog onOpenChange={(open) => { if (!open) onClose() }} open>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit wallet' : 'Add wallet'}</DialogTitle>
          <DialogDescription>{editing ? 'Update this wallet’s details.' : 'Add a wallet to track its balance.'}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit(submit)}>
          {submitError && <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive" role="alert">{submitError}</p>}
          <div className="space-y-1.5">
            <Label htmlFor="wallet-name">Name</Label>
            <Input aria-invalid={Boolean(errors.name)} autoFocus id="wallet-name" maxLength={40} {...register('name')} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wallet-type">Type</Label>
            <select aria-invalid={Boolean(errors.type)} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" id="wallet-type" {...register('type')}>
              {walletTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            {errors.type && <p className="text-xs text-destructive">{errors.type.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wallet-opening-balance">Opening balance (₹)</Label>
            <Input aria-invalid={Boolean(errors.openingBalance)} id="wallet-opening-balance" inputMode="decimal" placeholder="0.00" {...register('openingBalance')} />
            {errors.openingBalance && <p className="text-xs text-destructive">{errors.openingBalance.message}</p>}
          </div>
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button onClick={onClose} type="button" variant="outline">Cancel</Button>
            <Button disabled={isSubmitting || mutations.create.isPending || mutations.update.isPending} type="submit">
              {isSubmitting || mutations.create.isPending || mutations.update.isPending
                ? (editing ? 'Saving…' : 'Adding…')
                : (editing ? 'Save changes' : 'Add wallet')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default WalletForm
