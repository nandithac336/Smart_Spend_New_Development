import { fromPaise, toPaise } from '@/lib/money.js'
import { formatDateTimeLocal, localDateTimeToIso } from '@/lib/transactionDates.js'

export function statementDraftValues(draft, timeZone) {
  return {
    txnDate: draft.txnDate ? formatDateTimeLocal(new Date(draft.txnDate), timeZone) : '',
    description: draft.description ?? '',
    amount: draft.amountPaise == null ? '' : fromPaise(draft.amountPaise).toFixed(2),
    direction: draft.direction ?? '',
    categoryId: String(draft.categoryId ?? ''),
  }
}

export function validateStatementDraft(values, timeZone) {
  const errors = {}
  const amountPaise = toPaise(values.amount)
  const match = values.txnDate.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/)
  const dateValid = match &&
    new Date(`${match[1]}T00:00:00.000Z`).toISOString().slice(0, 10) === match[1] &&
    Number(match[2]) <= 23 && Number(match[3]) <= 59 &&
    !Number.isNaN(new Date(localDateTimeToIso(values.txnDate, timeZone)).getTime())
  if (!dateValid) errors.txnDate = 'Enter a valid transaction date and time.'
  if (amountPaise == null || amountPaise <= 0 || amountPaise > 10_000_000_000) {
    errors.amount = 'Enter a positive amount with up to two decimal places.'
  }
  if (!['debit', 'credit'].includes(values.direction)) errors.direction = 'Choose debit or credit.'
  return { errors, amountPaise }
}

export function statementDraftPayload(values, timeZone) {
  const { errors, amountPaise } = validateStatementDraft(values, timeZone)
  if (Object.keys(errors).length) return { errors }
  return {
    changes: {
      txnDate: localDateTimeToIso(values.txnDate, timeZone),
      description: values.description.trim() || null,
      amountPaise,
      direction: values.direction,
      categoryId: values.categoryId || null,
      reviewStatus: 'pending',
    },
  }
}
