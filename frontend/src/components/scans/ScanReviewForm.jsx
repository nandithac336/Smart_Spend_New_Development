import { useState } from 'react'
import { CheckCircle2, FileCheck2, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button.jsx'
import { useCategories } from '@/hooks/useCategories.js'
import { useWallets } from '@/hooks/useWallets.js'
import { formatINR } from '@/lib/money.js'
import { formatDateTimeLocal } from '@/lib/transactionDates.js'
import { getErrorMessage } from '@/lib/errors.js'
import ScanTransactionFields from './ScanTransactionFields.jsx'
import ScanTypeFields from './ScanTypeFields.jsx'
import {
  scanConfirmationPayload,
  scanDraftPayload,
  scanDraftValues,
  validateScanDraft,
} from '@/lib/scanForm.js'

function ScanReviewForm({ scan, timeZone, hasImagePreview, onScanChange, onConfirmed }) {
  const [values, setValues] = useState(() => scanDraftValues(scan, timeZone))
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [duplicateIds, setDuplicateIds] = useState(null)
  const { data: walletData, isLoading: walletsLoading, isError: walletsError, refetch: retryWallets } = useWallets()
  const wallets = (walletData?.wallets ?? []).filter((wallet) => !wallet.archived)
  const {
    data: categories = [],
    isLoading: categoriesLoading,
    isError: categoriesError,
    refetch: retryCategories,
  } = useCategories(values.type || undefined)
  const possibleDuplicates = scan.possibleDuplicates ?? []
  const duplicateList = duplicateIds
    ? duplicateIds.map((id) => possibleDuplicates.find((item) => String(item.transactionId) === String(id)) ?? { transactionId: id })
    : possibleDuplicates
  const isConfirmed = scan.extractionStatus === 'confirmed'
  const isBusy = saving || confirming

  function validateOptionalFields(errorsToUpdate) {
    if (values.tax.trim()) {
      const tax = Number(values.tax)
      if (!/^\d+(?:\.\d{1,2})?$/.test(values.tax) || !Number.isSafeInteger(Math.round(tax * 100)) || tax < 0 || tax > 100_000_000) {
        errorsToUpdate.tax = 'Enter a valid tax amount with up to two decimal places.'
      }
    }
    if (values.currency && !/^[A-Z]{3}$/.test(values.currency)) errorsToUpdate.currency = 'Use a three-letter currency code.'
  }

  function setField(name, value) {
    setValues((current) => {
      const next = { ...current, [name]: value }
      if (scan.type === 'upi' && name === 'paymentDirection') {
        next.type = value === 'out' ? 'expense' : value === 'in' ? 'income' : ''
        next.categoryId = ''
      }
      if (name === 'type') next.categoryId = ''
      return next
    })
    setErrors((current) => ({ ...current, [name]: '' }))
    setSubmitError('')
  }

  function validate() {
    const result = validateScanDraft(values, scan.type, timeZone)
    validateOptionalFields(result.errors)
    setErrors(result.errors)
    return Object.keys(result.errors).length === 0
  }

  async function saveDraft() {
    setSubmitError('')
    const result = validateScanDraft(values, scan.type, timeZone, { forConfirmation: false })
    validateOptionalFields(result.errors)
    setErrors(result.errors)
    if (Object.keys(result.errors).length > 0) return
    setSaving(true)
    try {
      const updated = await onScanChange(scan, scanDraftPayload(values, timeZone))
      toast.success(updated.extractionStatus === 'ready' ? 'Scan details saved. Review before confirming.' : 'Scan draft saved')
    } catch (error) {
      setSubmitError(getErrorMessage(error, 'Could not save the scan draft.'))
    } finally {
      setSaving(false)
    }
  }

  async function confirmTransaction(event) {
    event.preventDefault()
    setSubmitError('')
    if (!validate()) return
    if (!hasImagePreview) {
      setSubmitError('Select the original image again so you can review it before confirming.')
      return
    }
    if (duplicateList.length && !values.allowPossibleDuplicate) {
      setSubmitError('Review the possible duplicate matches and explicitly allow a duplicate before confirming.')
      return
    }
    setConfirming(true)
    try {
      const updated = await onScanChange(scan, scanDraftPayload(values, timeZone))
      if (updated.extractionStatus !== 'ready') {
        setSubmitError('Enter an amount and transaction date, then save the draft before confirming.')
        return
      }
      const result = await onConfirmed(updated, scanConfirmationPayload(values))
      toast.success(result.duplicate ? 'This scan was already added' : 'Transaction created from scan')
    } catch (error) {
      const ids = error.response?.data?.error?.details?.possibleDuplicates
      if (Array.isArray(ids)) setDuplicateIds(ids)
      setSubmitError(getErrorMessage(error, 'Could not confirm this transaction.'))
    } finally {
      setConfirming(false)
    }
  }

  if (isConfirmed) {
    return (
      <section aria-label="Confirmed scan" className="glass-flat rounded-2xl p-5">
        <p className="flex items-center gap-2 text-sm font-semibold text-income">
          <CheckCircle2 aria-hidden="true" className="size-5" />
          Transaction already created from this scan
        </p>
        <p className="mt-2 text-sm text-muted-foreground">The backend prevents the same scan from creating another transaction.</p>
      </section>
    )
  }

  return (
    <form className="glass-flat space-y-5 rounded-2xl p-4 sm:p-5" onSubmit={confirmTransaction}>
      <div>
        <h2 className="text-base font-semibold">Review extracted details</h2>
        <p className="mt-1 text-xs text-muted-foreground">OCR results can be wrong. Check the original image, edit the draft, then explicitly confirm to create a transaction.</p>
      </div>

      {scan.processingError?.message && (
        <p className="rounded-xl border border-amber-400/25 bg-amber-400/5 px-3 py-2 text-sm text-amber-200" role="status">
          {scan.processingError.message}. You can enter the missing details below.
        </p>
      )}
      {!hasImagePreview && (
        <p className="rounded-xl border border-amber-400/25 bg-amber-400/5 px-3 py-2 text-sm text-amber-200" role="status">
          The backend does not provide a saved-image preview. Re-select the original image to review it before creating a transaction.
        </p>
      )}
      {scan.warnings?.length > 0 && (
        <ul className="space-y-1 rounded-xl border border-amber-400/25 bg-amber-400/5 px-3 py-2 text-xs text-amber-200">
          {scan.warnings.map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}
        </ul>
      )}
      {scan.confidence?.overall != null && (
        <p className="text-xs text-muted-foreground">OCR confidence: {Math.round(scan.confidence.overall * 100)}%. Verify every field.</p>
      )}

      <ScanTransactionFields
        categories={categories}
        categoriesError={categoriesError}
        categoriesLoading={categoriesLoading}
        errors={errors}
        onChange={setField}
        retryCategories={retryCategories}
        retryWallets={retryWallets}
        values={values}
        wallets={wallets}
        walletsError={walletsError}
        walletsLoading={walletsLoading}
      />
      <ScanTypeFields errors={errors} onChange={setField} scan={scan} values={values} />

      {duplicateList.length > 0 && (
        <div className="space-y-3 rounded-xl border border-amber-400/30 bg-amber-400/5 p-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-200">
            <TriangleAlert aria-hidden="true" className="size-4" />
            Possible duplicate transaction{duplicateList.length === 1 ? '' : 's'}
          </p>
          <ul className="space-y-2 text-xs text-muted-foreground">
            {duplicateList.map((item, index) => (
              <li key={String(item.transactionId ?? index)}>
                {item.merchant || 'Existing transaction'} · {item.txnDate ? formatDateTimeLocal(new Date(item.txnDate), timeZone).replace('T', ' ') : 'date unavailable'} · {item.amountPaise == null ? 'amount unavailable' : formatINR(item.amountPaise)}
              </li>
            ))}
          </ul>
          <label className="flex cursor-pointer items-start gap-2 text-xs text-amber-100">
            <input checked={values.allowPossibleDuplicate} onChange={(event) => setField('allowPossibleDuplicate', event.target.checked)} type="checkbox" />
            I reviewed these matches and still want to create this transaction.
          </label>
        </div>
      )}

      {submitError && <p className="text-sm text-destructive" role="alert">{submitError}</p>}

      <div className="flex flex-col-reverse gap-2 border-t border-border/70 pt-4 sm:flex-row sm:justify-end">
        <Button disabled={isBusy || isConfirmed} onClick={saveDraft} type="button" variant="outline">
          <FileCheck2 aria-hidden="true" />
          {saving ? 'Saving…' : 'Save draft'}
        </Button>
        <Button
          disabled={isBusy || isConfirmed || !hasImagePreview || (duplicateList.length > 0 && !values.allowPossibleDuplicate)}
          type="submit"
        >
          {confirming ? 'Creating transaction…' : 'Confirm and create transaction'}
        </Button>
      </div>
    </form>
  )
}

export default ScanReviewForm
