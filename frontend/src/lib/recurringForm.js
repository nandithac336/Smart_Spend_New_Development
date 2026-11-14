import { z } from 'zod'
import { fromPaise, toPaise } from '@/lib/money.js'
import { isValidCalendarDate, scheduleCalendarDate } from './recurringDates.js'

const amountPattern = /^\d+(?:\.\d{1,2})?$/

export const recurringFormSchema = z.object({
  name: z.string().trim().min(1, 'Enter a schedule name').max(80, 'Name must be 80 characters or fewer'),
  type: z.enum(['expense', 'income']),
  amount: z.string().trim().regex(amountPattern, 'Enter an amount with up to 2 decimal places')
    .refine((value) => {
      const amount = toPaise(value)
      return amount !== null && amount > 0 && amount <= 10_000_000_000
    }, 'Enter a valid amount'),
  walletId: z.string().min(1, 'Choose a wallet'),
  categoryId: z.string(),
  description: z.string().max(300, 'Description must be 300 characters or fewer'),
  frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
  startDate: z.string().refine(isValidCalendarDate, 'Choose a valid start date'),
  endDate: z.string(),
}).superRefine((values, context) => {
  if (values.endDate) {
    if (!isValidCalendarDate(values.endDate)) {
      context.addIssue({ code: 'custom', path: ['endDate'], message: 'Choose a valid end date' })
    } else if (isValidCalendarDate(values.startDate) && values.endDate < values.startDate) {
      context.addIssue({ code: 'custom', path: ['endDate'], message: 'End date must be on or after start date' })
    }
  }
})

export function recurringId(schedule) {
  return schedule?.id ?? schedule?._id
}

function referenceId(value) {
  return value?.id ?? value?._id ?? value ?? ''
}

export function initialRecurringValues(schedule, today) {
  return {
    name: schedule?.name ?? '',
    type: schedule?.type ?? 'expense',
    amount: schedule ? fromPaise(schedule.amount).toFixed(2) : '',
    walletId: referenceId(schedule?.walletId),
    categoryId: referenceId(schedule?.categoryId),
    description: schedule?.description ?? '',
    frequency: schedule?.frequency ?? 'monthly',
    startDate: schedule ? scheduleCalendarDate(schedule.startDate) : today,
    endDate: schedule?.endDate ? scheduleCalendarDate(schedule.endDate) : '',
  }
}

export function recurringPayload(values, schedule) {
  const payload = {
    name: values.name.trim(),
    type: values.type,
    amount: toPaise(values.amount),
    walletId: values.walletId,
    categoryId: values.categoryId || null,
    description: values.description.trim(),
    frequency: values.frequency,
    startDate: values.startDate,
    endDate: values.endDate || null,
  }
  if (!schedule) return payload

  const original = {
    name: schedule.name,
    type: schedule.type,
    amount: Number(schedule.amount),
    walletId: referenceId(schedule.walletId),
    categoryId: referenceId(schedule.categoryId) || null,
    description: schedule.description ?? '',
    frequency: schedule.frequency,
    startDate: scheduleCalendarDate(schedule.startDate),
    endDate: schedule.endDate ? scheduleCalendarDate(schedule.endDate) : null,
  }
  return Object.fromEntries(Object.entries(payload).filter(([key, value]) => value !== original[key]))
}
