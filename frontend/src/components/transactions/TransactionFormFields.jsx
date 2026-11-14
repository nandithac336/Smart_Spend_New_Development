import { useEffect, useMemo, useRef, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { useCategories } from '@/hooks/useCategories.js'
import { useWallets } from '@/hooks/useWallets.js'
import { getErrorMessage, getFieldErrors } from '@/lib/errors.js'
import { formatDateTimeLocal, localDateTimeToIso } from '@/lib/transactionDates.js'
import { toPaise } from '@/lib/money.js'
import { Button } from '@/components/ui/button.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Label } from '@/components/ui/label.jsx'
import { useAuth } from '@/hooks/useAuth.js'
import { useOfflineReferenceData } from '@/hooks/useOfflineReferenceData.js'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.jsx'
import {
  initialTransactionValues,
  paymentMethods,
  transactionFormSchema,
  transactionId,
} from './transactionFormUtils.js'
import TransactionFormReferences from './TransactionFormReferences.jsx'

function TransactionFormFields({ transaction, timeZone, onClose, mutations }) {
  const editing = Boolean(transaction)
  const [submitError, setSubmitError] = useState('')
  const [clientId] = useState(() => editing ? undefined : window.crypto.randomUUID())
  const values = useMemo(() => initialTransactionValues(transaction, timeZone), [timeZone, transaction])
  const [now] = useState(() => new Date())
  const maxDate = formatDateTimeLocal(now, timeZone)
  const {
    control,
    handleSubmit,
    register,
    setError,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(transactionFormSchema(maxDate)),
    defaultValues: values,
  })
  const type = watch('type')
  const tagsText = watch('tagsText')
  const previousType = useRef(type)
  const { user } = useAuth()
  const userId = user?.id ?? user?._id
  const walletQuery = useWallets()
  const walletData = walletQuery.data?.wallets ?? (
    Array.isArray(walletQuery.data) ? walletQuery.data : undefined
  )
  const cachedWallets = useOfflineReferenceData(userId, 'wallets', walletData)
  const wallets = walletData ?? cachedWallets.data ?? []
  const hasWalletData = Array.isArray(walletData) || Array.isArray(cachedWallets.data)
  const walletsLoading = walletQuery.isPending && !hasWalletData
  const walletsError = walletQuery.isError && !hasWalletData
  const refetchWallets = walletQuery.refetch
  const categoriesQuery = useCategories(type)
  const cachedCategories = useOfflineReferenceData(userId, `categories-${type}`, categoriesQuery.data)
  const categories = categoriesQuery.data ?? cachedCategories.data ?? []
  const hasCategoryData = Array.isArray(categoriesQuery.data) || Array.isArray(cachedCategories.data)
  const categoriesLoading = categoriesQuery.isPending && !hasCategoryData
  const categoriesError = categoriesQuery.isError && !hasCategoryData
  const refetchCategories = categoriesQuery.refetch

  useEffect(() => {
    if (previousType.current !== type) {
      setValue('categoryId', '', { shouldDirty: true })
      previousType.current = type
    }
  }, [setValue, type])

  function changedFields(formValues) {
    const tags = formValues.tagsText.split(',').map((tag) => tag.trim()).filter(Boolean)
    const txnDate = localDateTimeToIso(formValues.txnDate, timeZone)
    const payload = {
      amount: toPaise(formValues.amount),
      walletId: formValues.walletId,
      categoryId: formValues.categoryId || null,
      merchant: formValues.merchant.trim(),
      note: formValues.note.trim(),
      tags,
      paymentMethod: formValues.paymentMethod,
      txnDate,
    }
    if (!editing) {
      const createPayload = {
        ...payload,
        type: formValues.type,
        clientId,
        source: 'manual',
      }
      if (!createPayload.categoryId) delete createPayload.categoryId
      return createPayload
    }

    const original = {
      amount: Number(transaction.amount),
      walletId: transaction.walletId?.id ?? transaction.walletId?._id ?? transaction.walletId,
      categoryId: transaction.categoryId?.id ?? transaction.categoryId?._id ?? transaction.categoryId ?? null,
      merchant: transaction.merchant ?? '',
      note: transaction.note ?? '',
      tags: transaction.tags ?? [],
      paymentMethod: transaction.paymentMethod ?? 'cash',
      txnDate: new Date(transaction.txnDate).toISOString(),
    }
    return Object.fromEntries(Object.entries(payload).filter(([key, value]) => {
      if (key === 'tags') return JSON.stringify(value) !== JSON.stringify(original.tags)
      if (key === 'txnDate') return formValues.txnDate !== initialTransactionValues(transaction, timeZone).txnDate
      return value !== original[key]
    }))
  }

  function submit(formValues) {
    setSubmitError('')
    const payload = changedFields(formValues)
    if (editing && Object.keys(payload).length === 0) {
      onClose()
      return
    }

    const request = editing
      ? mutations.update.mutateAsync({ id: transactionId(transaction), payload, transaction })
      : mutations.create.mutateAsync(payload)
    return request.then((response) => {
        if (response?.pendingSync) toast.success(editing ? 'Update queued; pending sync' : 'Saved offline; pending sync')
        else if (!editing) toast.success(response?.duplicate ? 'Already saved' : 'Added')
        else toast.success('Transaction updated')
      onClose()
    }, (error) => {
      const fieldErrors = getFieldErrors(error)
      let hasMappedFieldError = false
      Object.entries(fieldErrors).forEach(([field, message]) => {
        if (['amount', 'walletId', 'categoryId', 'merchant', 'note', 'tags', 'paymentMethod', 'txnDate', 'type'].includes(field)) {
          setError(field === 'tags' ? 'tagsText' : field, { type: 'server', message })
          hasMappedFieldError = true
        }
      })
      if (!hasMappedFieldError) setSubmitError(getErrorMessage(error, 'Could not save this transaction. Please try again.'))
    })
  }

  const tags = (tagsText ?? '').split(',').map((tag) => tag.trim()).filter(Boolean)
  const waitingForWallets = walletsLoading
  return (
    <form className="space-y-4" onSubmit={handleSubmit(submit)}>
      {!editing && (
        <div aria-label="Transaction type" className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-1">
          {['expense', 'income'].map((value) => (
            <Button
              aria-pressed={type === value}
              className={type === value ? 'bg-background shadow-sm' : 'text-muted-foreground'}
              key={value}
              onClick={() => setValue('type', value, { shouldDirty: true })}
              type="button"
              variant="ghost"
            >
              {value === 'expense' ? 'Expense' : 'Income'}
            </Button>
          ))}
        </div>
      )}
      {editing && <p className="text-sm font-medium capitalize text-muted-foreground">{type}</p>}
      <div className="space-y-1.5">
        <Label htmlFor="transaction-amount">Amount (₹)</Label>
        <Input aria-invalid={Boolean(errors.amount)} autoFocus inputMode="decimal" id="transaction-amount" max="100000000" pattern="^\d+(\.\d{1,2})?$" placeholder="120.50" {...register('amount')} />
        {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
      </div>
      <TransactionFormReferences
        categories={categories}
        categoriesError={categoriesError}
        categoriesLoading={categoriesLoading}
        control={control}
        errors={errors}
        onCategoryCreated={(category) => setValue('categoryId', category.id ?? category._id, { shouldDirty: true })}
        refetchCategories={refetchCategories}
        refetchWallets={refetchWallets}
        wallets={wallets}
        walletsError={walletsError}
        walletsLoading={waitingForWallets}
        type={type}
      />
      <div className="space-y-1.5">
        <Label htmlFor="transaction-merchant">Merchant</Label>
        <Input id="transaction-merchant" maxLength={80} {...register('merchant')} />
        {errors.merchant && <p className="text-xs text-destructive">{errors.merchant.message}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="transaction-note">Note</Label>
        <Input id="transaction-note" maxLength={300} {...register('note')} />
        {errors.note && <p className="text-xs text-destructive">{errors.note.message}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="transaction-tags">Tags (comma separated)</Label>
        <Input id="transaction-tags" maxLength={309} placeholder="groceries, weekend" {...register('tagsText')} />
        {tags.length > 0 && <div className="flex flex-wrap gap-1.5">{tags.map((tag, index) => <span className="rounded-full bg-accent px-2.5 py-1 text-xs text-accent-foreground" key={`${tag}-${index}`}>{tag}</span>)}</div>}
        {errors.tagsText && <p className="text-xs text-destructive">{errors.tagsText.message}</p>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="transaction-payment">Payment method</Label>
          <Controller
            control={control}
            name="paymentMethod"
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger className="h-10 w-full" id="transaction-payment"><SelectValue /></SelectTrigger>
                <SelectContent>{paymentMethods.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="transaction-date">Date and time</Label>
          <Input aria-invalid={Boolean(errors.txnDate)} id="transaction-date" max={maxDate} type="datetime-local" {...register('txnDate')} />
          {errors.txnDate && <p className="text-xs text-destructive">{errors.txnDate.message}</p>}
        </div>
      </div>
      {submitError && <p className="text-sm text-destructive" role="alert">{submitError}</p>}
      <div className="flex justify-end gap-2 border-t pt-4">
        <Button onClick={onClose} type="button" variant="outline">Cancel</Button>
        <Button disabled={isSubmitting || mutations.create.isPending || mutations.update.isPending || waitingForWallets || walletsError || wallets.length === 0} type="submit">
          {isSubmitting || mutations.create.isPending || mutations.update.isPending
            ? 'Saving…'
            : editing ? 'Save changes' : 'Add transaction'}
        </Button>
      </div>
    </form>
  )
}

export default TransactionFormFields
