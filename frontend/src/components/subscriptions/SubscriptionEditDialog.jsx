import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button.jsx'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.jsx'
import { Input } from '@/components/ui/input.jsx'
import { useCategories } from '@/hooks/useCategories.js'
import { fromPaise, toPaise } from '@/lib/money.js'

const frequencies = ['weekly', 'monthly', 'quarterly', 'annual']

function toDateInput(value) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
}

function SubscriptionEditDialog({ subscription, busy, onClose, onSave }) {
  const [merchantName, setMerchantName] = useState(subscription.merchantName || '')
  const [amount, setAmount] = useState(Number.isSafeInteger(subscription.averageAmountPaise)
    ? fromPaise(subscription.averageAmountPaise).toFixed(2)
    : '')
  const [frequency, setFrequency] = useState(subscription.frequency || 'monthly')
  const [nextDate, setNextDate] = useState(toDateInput(subscription.estimatedNextPaymentDate))
  const [categoryId, setCategoryId] = useState(subscription.categoryId || 'uncategorized')
  const categories = useCategories('expense')

  function submit(event) {
    event.preventDefault()
    const trimmedMerchant = merchantName.trim()
    const amountPaise = toPaise(amount)
    if (!trimmedMerchant) {
      toast.error('Enter a merchant or service name.')
      return
    }
    if (amountPaise === null || amountPaise <= 0) {
      toast.error('Enter a valid payment amount greater than zero.')
      return
    }
    if (!frequencies.includes(frequency)) {
      toast.error('Choose a supported billing frequency.')
      return
    }
    const parsedDate = new Date(`${nextDate}T00:00:00.000Z`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(nextDate) || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== nextDate) {
      toast.error('Choose a valid next expected payment date.')
      return
    }
    onSave({
      merchantName: trimmedMerchant,
      averageAmountPaise: amountPaise,
      frequency,
      estimatedNextPaymentDate: nextDate,
      categoryId: categoryId === 'uncategorized' ? null : categoryId,
    })
  }

  return (
    <Dialog onOpenChange={(open) => { if (!open) onClose() }} open={Boolean(subscription)}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit detected subscription</DialogTitle>
          <DialogDescription>Update the subscription details. This does not create a transaction or change its review status.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <label className="block space-y-1.5 text-xs font-medium">
            Merchant or service
            <Input autoComplete="off" maxLength={120} onChange={(event) => setMerchantName(event.target.value)} required value={merchantName} />
          </label>
          <label className="block space-y-1.5 text-xs font-medium">
            Average payment (₹)
            <Input inputMode="decimal" onChange={(event) => setAmount(event.target.value)} required value={amount} />
          </label>
          <label className="block space-y-1.5 text-xs font-medium">
            Billing frequency
            <select className="h-10 w-full rounded-xl border border-input bg-background/45 px-3 text-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50" onChange={(event) => setFrequency(event.target.value)} value={frequency}>
              {frequencies.map((item) => <option key={item} value={item}>{item[0].toUpperCase() + item.slice(1)}</option>)}
            </select>
          </label>
          <label className="block space-y-1.5 text-xs font-medium">
            Next expected payment date
            <Input onChange={(event) => setNextDate(event.target.value)} required type="date" value={nextDate} />
          </label>
          <label className="block space-y-1.5 text-xs font-medium">
            Category
            <select
              className="h-10 w-full rounded-xl border border-input bg-background/45 px-3 text-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              disabled={categories.isPending || categories.isError}
              onChange={(event) => setCategoryId(event.target.value)}
              value={categoryId}
            >
              <option value="uncategorized">Uncategorized</option>
              {subscription.categoryId && !(categories.data ?? []).some((category) => String(category.id ?? category._id) === String(subscription.categoryId)) && (
                <option value={subscription.categoryId}>Existing category</option>
              )}
              {(categories.data ?? []).map((category) => (
                <option key={category.id ?? category._id} value={category.id ?? category._id}>{category.name}</option>
              ))}
            </select>
            {categories.isError && <span className="block font-normal text-destructive">Categories could not be loaded. Try again before changing category.</span>}
          </label>
          <DialogFooter>
            <Button disabled={busy} onClick={onClose} type="button" variant="outline">Cancel</Button>
            <Button disabled={busy || categories.isError} type="submit">{busy ? 'Saving…' : 'Save changes'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default SubscriptionEditDialog
