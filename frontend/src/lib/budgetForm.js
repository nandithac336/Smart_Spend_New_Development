import { z } from 'zod'
import { fromPaise, toPaise } from '@/lib/money.js'
import { budgetDateRange, validCalendarDate } from './budgetHelpers.js'

const amountPattern = /^\d+(?:\.\d{1,2})?$/
const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/
const yearPattern = /^\d{4}$/

export const budgetFormSchema = z.object({
  name: z.string().trim().min(1, 'Enter a budget name').max(60, 'Budget name must be 60 characters or fewer'),
  amount: z.string().trim().regex(amountPattern, 'Enter an amount with up to 2 decimal places')
    .refine((value) => {
      const paise = toPaise(value)
      return paise !== null && paise > 0 && paise <= 10_000_000_000
    }, 'Enter a valid budget amount'),
  categoryId: z.string(),
  period: z.enum(['weekly', 'monthly', 'yearly', 'custom']),
  month: z.string(),
  weekStart: z.string(),
  year: z.string(),
  customStart: z.string(),
  customEnd: z.string(),
}).superRefine((values, context) => {
  if (values.period === 'monthly' && !monthPattern.test(values.month)) {
    context.addIssue({ code: 'custom', path: ['month'], message: 'Choose a valid month' })
  }
  if (values.period === 'yearly' && !yearPattern.test(values.year)) {
    context.addIssue({ code: 'custom', path: ['year'], message: 'Enter a valid year' })
  }
  if (values.period === 'weekly') {
    if (!validCalendarDate(values.weekStart)) {
      context.addIssue({ code: 'custom', path: ['weekStart'], message: 'Choose a valid week start date' })
    } else if (new Date(`${values.weekStart}T00:00:00.000Z`).getUTCDay() !== 1) {
      context.addIssue({ code: 'custom', path: ['weekStart'], message: 'A weekly budget must start on Monday' })
    }
  }
  if (values.period === 'custom') {
    if (!validCalendarDate(values.customStart)) {
      context.addIssue({ code: 'custom', path: ['customStart'], message: 'Choose a valid start date' })
    }
    if (!validCalendarDate(values.customEnd)) {
      context.addIssue({ code: 'custom', path: ['customEnd'], message: 'Choose a valid end date' })
    }
    if (validCalendarDate(values.customStart) && validCalendarDate(values.customEnd)
      && values.customStart > values.customEnd) {
      context.addIssue({ code: 'custom', path: ['customEnd'], message: 'End date must be on or after start date' })
    }
  }
})

export function initialBudgetFormValues(budget, month) {
  const range = budget ? budgetDateRange(budget) : { start: `${month}-01`, end: `${month}-01` }
  return {
    name: budget?.name ?? '',
    amount: budget ? fromPaise(budget.amount).toFixed(2) : '',
    categoryId: budget?.categoryId?._id ?? budget?.categoryId?.id ?? budget?.categoryId ?? '',
    period: budget?.period ?? 'monthly',
    month: range.start.slice(0, 7),
    weekStart: range.start,
    year: range.start.slice(0, 4),
    customStart: range.start,
    customEnd: range.end,
  }
}
