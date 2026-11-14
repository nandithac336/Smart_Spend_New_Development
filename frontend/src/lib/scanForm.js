import { fromPaise, toPaise } from '@/lib/money.js'
import { formatDateTimeLocal, localDateTimeToIso } from '@/lib/transactionDates.js'

export const MAX_SCAN_IMAGE_BYTES = 5 * 1024 * 1024
export const SCAN_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export function validateScanFile(file) {
  if (!file) return 'Choose an image to scan.'
  if (!SCAN_IMAGE_TYPES.includes(file.type)) return 'Choose a JPEG, PNG, or WebP image.'
  if (file.size > MAX_SCAN_IMAGE_BYTES) return 'Image must be 5 MB or smaller.'
  if (file.size === 0) return 'The selected image is empty.'
  return ''
}

export function scanDraftValues(scan, timeZone, now = new Date()) {
  const draft = scan?.draftFields ?? {}
  const amount = draft.amountPaise == null ? '' : fromPaise(draft.amountPaise).toFixed(2)
  const validDate = draft.transactionDate && !Number.isNaN(new Date(draft.transactionDate).getTime())
    ? new Date(draft.transactionDate)
    : null
  return {
    merchant: draft.merchant ?? '',
    amount,
    transactionDate: validDate ? formatDateTimeLocal(validDate, timeZone) : '',
    type: draft.transactionType ?? '',
    walletId: '',
    categoryId: '',
    paymentMethod: scan?.type === 'upi' ? 'upi' : '',
    note: '',
    tax: draft.taxPaise == null ? '' : fromPaise(draft.taxPaise).toFixed(2),
    currency: draft.currency ?? '',
    upiRef: draft.upiRef ?? '',
    paymentStatus: draft.paymentStatus ?? '',
    paymentDirection: draft.paymentDirection ?? '',
    allowPossibleDuplicate: false,
    maxDate: formatDateTimeLocal(now, timeZone),
  }
}

export function validateScanDraft(values, scanType, timeZone, { forConfirmation = true } = {}) {
  const errors = {}
  const amountPaise = toPaise(values.amount)
  if (
    (forConfirmation || values.amount !== '') &&
    (amountPaise === null || amountPaise <= 0 || amountPaise > 10_000_000_000)
  ) {
    errors.amount = 'Enter a valid amount with up to two decimal places.'
  }
  if (
    (forConfirmation || values.transactionDate !== '') &&
    (!values.transactionDate || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(values.transactionDate))
  ) {
    errors.transactionDate = 'Enter the transaction date and time.'
  } else if (
    values.transactionDate &&
    Number.isNaN(new Date(localDateTimeToIso(values.transactionDate, timeZone)).getTime())
  ) {
    errors.transactionDate = 'Enter a valid transaction date and time.'
  } else if (
    values.transactionDate &&
    new Date(localDateTimeToIso(values.transactionDate, timeZone)).getTime() > Date.now() + 86_400_000
  ) {
    errors.transactionDate = 'Transaction date cannot be more than one day in the future.'
  }
  if (forConfirmation && !values.type) errors.type = 'Choose whether this is income or expense.'
  if (forConfirmation && !values.walletId) errors.walletId = 'Choose a wallet.'
  if (forConfirmation && !values.paymentMethod) errors.paymentMethod = 'Choose a payment method.'
  if (scanType === 'upi' && forConfirmation) {
    if (values.paymentStatus !== 'success') errors.paymentStatus = 'Confirm the screenshot shows a successful payment.'
    if (!values.paymentDirection) errors.paymentDirection = 'Choose whether the payment was sent or received.'
    if (
      (values.paymentDirection === 'out' && values.type !== 'expense') ||
      (values.paymentDirection === 'in' && values.type !== 'income')
    ) errors.type = 'Transaction type must match the UPI payment direction.'
  }
  if (values.currency && !/^[A-Z]{3}$/.test(values.currency)) {
    errors.currency = 'Use a three-letter currency code.'
  }
  return { errors, amountPaise }
}

export function scanDraftPayload(values, timeZone) {
  const amountPaise = toPaise(values.amount)
  const transactionDate = localDateTimeToIso(values.transactionDate, timeZone)
  const taxPaise = values.tax.trim() ? toPaise(values.tax) : null
  const payload = {
    merchant: values.merchant.trim() || null,
    amountPaise,
    transactionDate,
    currency: values.currency.trim() || null,
    taxPaise,
  }
  payload.upiRef = values.upiRef.trim() || null
  payload.paymentStatus = values.paymentStatus || null
  payload.paymentDirection = values.paymentDirection || null
  payload.transactionType = values.paymentDirection === 'out'
    ? 'expense'
    : values.paymentDirection === 'in'
      ? 'income'
      : null
  return payload
}

export function scanConfirmationPayload(values) {
  return {
    type: values.type,
    walletId: values.walletId,
    categoryId: values.categoryId || null,
    merchant: values.merchant.trim(),
    note: values.note.trim(),
    paymentMethod: values.paymentMethod,
    allowPossibleDuplicate: values.allowPossibleDuplicate,
  }
}
