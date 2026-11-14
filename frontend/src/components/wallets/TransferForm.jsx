import { useRef, useState } from 'react'
import { AnimatePresence, m } from 'motion/react'
import { ArrowRight, Check } from 'lucide-react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import CountUp from '@/components/motion/CountUp.jsx'
import { useMotionDisabled } from '@/hooks/useMotionDisabled.js'
import { getErrorMessage } from '@/lib/errors.js'
import { formatINR, toPaise } from '@/lib/money.js'
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

const amountPattern = /^\d+(?:\.\d{1,2})?$/
const walletPreviewStyles = {
  cash: 'border-emerald-500/30 bg-emerald-500/5',
  bank: 'border-blue-500/30 bg-blue-500/5',
  upi: 'border-violet-500/30 bg-violet-500/5',
  card: 'border-amber-500/30 bg-amber-500/5',
}
const transferSchema = z.object({
  fromWalletId: z.string().min(1, 'Choose a source wallet'),
  toWalletId: z.string().min(1, 'Choose a destination wallet'),
  amount: z.string().trim().regex(amountPattern, 'Enter an amount with up to 2 decimal places')
    .refine((value) => {
      const amount = toPaise(value)
      return amount !== null && amount > 0 && amount <= 10_000_000_000
    }, 'Amount must be greater than zero and within the allowed limit'),
  note: z.string().max(300, 'Note must be 300 characters or fewer'),
}).refine((values) => values.fromWalletId !== values.toWalletId, {
  path: ['toWalletId'],
  message: 'Choose a different destination wallet',
})

function walletId(wallet) {
  return wallet.id ?? wallet._id
}

function TransferForm({ wallets, mutations, onClose, onTransferAnimationComplete = () => {} }) {
  const motionDisabled = useMotionDisabled()
  const [successfulTransfer, setSuccessfulTransfer] = useState(null)
  const [successfulAnimationDone, setSuccessfulAnimationDone] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const animationCompleted = useRef(false)
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      fromWalletId: wallets.length > 0 ? walletId(wallets[0]) : '',
      toWalletId: wallets.length > 1 ? walletId(wallets[1]) : '',
      amount: '',
      note: '',
    },
  })
  const fromWalletId = watch('fromWalletId')
  const toWalletId = watch('toWalletId')
  const fromWallet = wallets.find((wallet) => walletId(wallet) === fromWalletId)
  const toWallet = wallets.find((wallet) => walletId(wallet) === toWalletId)

  async function submit(values) {
    setSubmitError('')
    try {
      const amountPaise = toPaise(values.amount)
      await mutations.transfer.mutateAsync({
        fromWalletId: values.fromWalletId,
        toWalletId: values.toWalletId,
        amount: amountPaise,
        ...(values.note.trim() ? { note: values.note.trim() } : {}),
      })
      setSuccessfulTransfer({
        amount: amountPaise,
        sourceId: values.fromWalletId,
        destinationId: values.toWalletId,
        sourceBalance: fromWallet?.balance ?? 0,
        destinationBalance: toWallet?.balance ?? 0,
      })
      if (motionDisabled) {
        animationCompleted.current = true
        setSuccessfulAnimationDone(true)
        onTransferAnimationComplete()
      }
    } catch (error) {
      setSubmitError(getErrorMessage(error, 'Could not complete the transfer. Please try again.'))
    }
  }

  const hasTwoWallets = wallets.length >= 2
  const destinationOptions = wallets.filter((wallet) => walletId(wallet) !== fromWalletId)
  const successfulSource = wallets.find((wallet) => walletId(wallet) === successfulTransfer?.sourceId)
  const successfulDestination = wallets.find((wallet) => walletId(wallet) === successfulTransfer?.destinationId)

  function skipTransferAnimation() {
    if (!animationCompleted.current) {
      animationCompleted.current = true
      onTransferAnimationComplete()
    }
    onClose()
  }

  function completeTransferAnimation() {
    if (!animationCompleted.current) {
      animationCompleted.current = true
      setSuccessfulAnimationDone(true)
      onTransferAnimationComplete()
    }
  }

  return (
    <Dialog onOpenChange={(open) => { if (!open) onClose() }} open>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Transfer money</DialogTitle>
          <DialogDescription>Move money between your wallets without counting it as spending.</DialogDescription>
        </DialogHeader>
        {!hasTwoWallets ? (
          <p className="rounded-xl border border-border bg-muted p-4 text-sm text-muted-foreground">
            Add at least two wallets before making a transfer.
          </p>
        ) : successfulTransfer ? (
          <div className="space-y-5">
            <div className="relative flex items-center justify-between gap-3 overflow-hidden rounded-2xl">
              <TransferWalletPreview
                balance={successfulAnimationDone ? successfulSource?.balance : successfulTransfer.sourceBalance}
                wallet={successfulSource}
              />
              <ArrowRight aria-hidden="true" className={`size-5 shrink-0 text-primary ${motionDisabled ? '' : 'animate-pulse'}`} />
              <TransferWalletPreview
                balance={successfulAnimationDone ? successfulDestination?.balance : successfulTransfer.destinationBalance}
                wallet={successfulDestination}
              />
              {!motionDisabled && (
                <AnimatePresence>
                  <m.span
                    animate={{ opacity: [0, 1, 1, 0], x: [0, 42, 110, 150], scale: [0.85, 1, 1, 0.85] }}
                    className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-lg"
                    exit={{ opacity: 0 }}
                    initial={{ opacity: 0, x: 0, scale: 0.85 }}
                    key="transfer-flight"
                    onAnimationComplete={completeTransferAnimation}
                    transition={{ duration: 0.68, ease: 'easeInOut' }}
                  >
                    {formatINR(successfulTransfer.amount)}
                  </m.span>
                </AnimatePresence>
              )}
            </div>
            <p aria-live="polite" className="flex items-center gap-2 text-sm font-medium text-emerald-600">
              <Check aria-hidden="true" className="size-4" />
              Transfer complete. Wallet balances have been updated.
            </p>
            <div className="flex justify-end">
              <Button onClick={skipTransferAnimation}>{motionDisabled || successfulAnimationDone ? 'Done' : 'Skip animation'}</Button>
            </div>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit(submit)}>
            {submitError && <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive" role="alert">{submitError}</p>}
            <div className="relative flex items-center justify-between gap-3 overflow-hidden rounded-2xl">
              <TransferWalletPreview balance={fromWallet?.balance} wallet={fromWallet} />
              <m.span
                animate={motionDisabled ? undefined : { x: [0, 4, 0] }}
                aria-hidden="true"
                className="z-10 flex size-8 shrink-0 items-center justify-center rounded-full bg-background text-primary shadow-sm"
                transition={motionDisabled ? { duration: 0 } : { repeat: Infinity, duration: 1.4, ease: 'easeInOut' }}
              >
                <ArrowRight className="size-4" />
              </m.span>
              <TransferWalletPreview balance={toWallet?.balance} wallet={toWallet} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="transfer-from">From wallet</Label>
              <select aria-invalid={Boolean(errors.fromWalletId)} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" id="transfer-from" {...register('fromWalletId')}>
                {wallets.map((wallet) => <option key={walletId(wallet)} value={walletId(wallet)} disabled={walletId(wallet) === toWalletId}>{wallet.name}</option>)}
              </select>
              {errors.fromWalletId && <p className="text-xs text-destructive">{errors.fromWalletId.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="transfer-to">To wallet</Label>
              <select aria-invalid={Boolean(errors.toWalletId)} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" id="transfer-to" {...register('toWalletId')}>
                <option value="">Choose wallet</option>
                {wallets.map((wallet) => <option key={walletId(wallet)} value={walletId(wallet)} disabled={walletId(wallet) === fromWalletId}>{wallet.name}</option>)}
              </select>
              {errors.toWalletId && <p className="text-xs text-destructive">{errors.toWalletId.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="transfer-amount">Amount (₹)</Label>
              <Input aria-invalid={Boolean(errors.amount)} id="transfer-amount" inputMode="decimal" placeholder="1000.00" {...register('amount')} />
              {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="transfer-note">Note (optional)</Label>
              <Input aria-invalid={Boolean(errors.note)} id="transfer-note" maxLength={300} {...register('note')} />
              {errors.note && <p className="text-xs text-destructive">{errors.note.message}</p>}
            </div>
            <div className="flex justify-end gap-2 border-t pt-4">
              <Button onClick={onClose} type="button" variant="outline">Cancel</Button>
              <Button disabled={isSubmitting || mutations.transfer.isPending || destinationOptions.length === 0} type="submit">
                {isSubmitting || mutations.transfer.isPending ? 'Transferring…' : 'Transfer money'}
              </Button>
            </div>
          </form>
        )}
        {!hasTwoWallets && (
          <div className="flex justify-end">
            <Button onClick={onClose} type="button" variant="outline">Close</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function TransferWalletPreview({ wallet, balance }) {
  return (
    <div className={`glass-flat min-w-0 flex-1 rounded-xl border px-3 py-3 ${walletPreviewStyles[wallet?.type] ?? 'border-border'}`}>
      <p className="truncate text-xs text-muted-foreground">{wallet?.name ?? 'Choose wallet'}</p>
      <p className="mt-1 truncate text-sm font-semibold">
        {wallet ? <CountUp currency value={balance ?? 0} /> : '—'}
      </p>
    </div>
  )
}

export default TransferForm
