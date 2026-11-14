import { m } from 'motion/react'
import { useMotionDisabled } from '@/hooks/useMotionDisabled.js'
import { useMediaQuery } from '@/hooks/useMediaQuery.js'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.jsx'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet.jsx'
import TransactionFormFields from './TransactionFormFields.jsx'
import { transactionId } from './transactionFormUtils.js'

function TransactionForm({ transaction, timeZone, onClose, mutations }) {
  const editing = Boolean(transaction)
  const mobile = useMediaQuery('(max-width: 639px)')
  const motionDisabled = useMotionDisabled()
  const fields = (
    <TransactionFormFields
      key={editing ? transactionId(transaction) : 'new'}
      mutations={mutations}
      onClose={onClose}
      timeZone={timeZone}
      transaction={transaction}
    />
  )

  if (mobile) {
    return (
      <Sheet onOpenChange={(open) => { if (!open) onClose() }} open>
        <SheetContent className="max-h-[92dvh] overflow-y-auto rounded-t-3xl p-5" side="bottom">
          <m.div
            animate={{ opacity: 1, y: 0 }}
            initial={motionDisabled ? false : { opacity: 0, y: 24 }}
            transition={motionDisabled ? { duration: 0 } : { type: 'spring', stiffness: 360, damping: 30 }}
          >
            <SheetHeader className="px-0 pt-1">
              <SheetTitle>{editing ? 'Edit transaction' : 'Add transaction'}</SheetTitle>
              <SheetDescription>Enter the details for this transaction.</SheetDescription>
            </SheetHeader>
            {fields}
          </m.div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Dialog onOpenChange={(open) => { if (!open) onClose() }} open>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <m.div
          animate={{ opacity: 1, scale: 1, y: 0 }}
          initial={motionDisabled ? false : { opacity: 0, scale: 0.97, y: 12 }}
          transition={motionDisabled ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 30 }}
        >
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit transaction' : 'Add transaction'}</DialogTitle>
            <DialogDescription>Enter the details for this transaction.</DialogDescription>
          </DialogHeader>
          {fields}
        </m.div>
      </DialogContent>
    </Dialog>
  )
}

export default TransactionForm
