import { z } from 'zod'
import { fromPaise, toPaise } from '@/lib/money.js'
import { formatDateTimeLocal } from '@/lib/transactionDates.js'

const amountPattern = /^\d+(?:\.\d{1,2})?$/

export const paymentMethods = [
  ['cash', 'Cash'],
  ['upi', 'UPI'],
  ['debit_card', 'Debit card'],
  ['credit_card', 'Credit card'],
  ['net_banking', 'Net banking'],
]

export function transactionFormSchema(maxDate) {
  return z.object({
    type: z.enum(['expense', 'income']),
    amount: z.string().trim().regex(amountPattern, 'Enter an amount with up to 2 decimal places')
      .refine((value) => {
        const paise = toPaise(value)
        return paise !== null && paise > 0 && paise <= 10_000_000_000
      }, 'Amount must be greater than zero and within the allowed limit'),
    walletId: z.string().min(1, 'Choose a wallet'),
    categoryId: z.string(),
    merchant: z.string().max(80, 'Merchant must be 80 characters or fewer'),
    note: z.string().max(300, 'Note must be 300 characters or fewer'),
    tagsText: z.string().superRefine((value, context) => {
      const tags = value.split(',').map((tag) => tag.trim()).filter(Boolean)
      if (tags.length > 10) context.addIssue({ code: 'custom', message: 'Use at most 10 tags' })
      if (tags.some((tag) => tag.length > 30)) context.addIssue({ code: 'custom', message: 'Each tag must be 30 characters or fewer' })
    }),
    paymentMethod: z.enum(['cash', 'upi', 'debit_card', 'credit_card', 'net_banking']),
    txnDate: z.string().min(1, 'Choose a date and time')
      .refine((value) => !Number.isNaN(new Date(value).getTime()), 'Enter a valid date and time')
      .refine((value) => value <= maxDate, 'Date cannot be in the future'),
  })
}

export function transactionId(transaction) {
  return transaction?.id ?? transaction?._id
}

export function initialTransactionValues(transaction, timeZone) {
  return {
    type: transaction?.type === 'income' ? 'income' : 'expense',
    amount: transaction ? fromPaise(transaction.amount).toFixed(2) : '',
    walletId: transaction?.walletId?.id ?? transaction?.walletId?._id ?? transaction?.walletId ?? '',
    categoryId: transaction?.categoryId?.id ?? transaction?.categoryId?._id ?? transaction?.categoryId ?? '',
    merchant: transaction?.merchant ?? '',
    note: transaction?.note ?? '',
    tagsText: (transaction?.tags ?? []).join(', '),
    paymentMethod: transaction?.paymentMethod ?? 'cash',
    txnDate: transaction?.txnDate
      ? formatDateTimeLocal(new Date(transaction.txnDate), timeZone)
      : formatDateTimeLocal(new Date(), timeZone),
  }
}
