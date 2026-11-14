import { z } from 'zod'
import { fromPaise, toPaise } from '@/lib/money.js'
import { validCalendarDate } from './budgetHelpers.js'

const amountPattern = /^\d+(?:\.\d{1,2})?$/

export function goalFormSchema(savedAmount = 0) {
  return z.object({
    name: z.string().trim().min(1, 'Enter a goal name').max(80, 'Goal name must be 80 characters or fewer'),
    description: z.string().max(500, 'Description must be 500 characters or fewer'),
    targetAmount: z.string().trim().regex(amountPattern, 'Enter an amount with up to 2 decimal places')
      .refine((value) => {
        const amount = toPaise(value)
        return amount !== null && amount > 0 && amount <= 10_000_000_000
      }, 'Enter a valid target amount')
      .refine((value) => {
        const amount = toPaise(value)
        return amount === null || amount >= savedAmount
      }, 'Target cannot be less than the amount already saved'),
    targetDate: z.string().refine(validCalendarDate, 'Choose a valid target date'),
  })
}

export function initialGoalFormValues(goal) {
  return {
    name: goal?.name ?? '',
    description: goal?.description ?? '',
    targetAmount: goal ? fromPaise(goal.targetAmount).toFixed(2) : '',
    targetDate: goal?.targetDate ? new Date(goal.targetDate).toISOString().slice(0, 10) : '',
  }
}

export function goalPayload(values) {
  return {
    name: values.name.trim(),
    description: values.description.trim(),
    targetAmount: toPaise(values.targetAmount),
    targetDate: values.targetDate,
  }
}

export function contributionPayload(values) {
  return {
    amount: toPaise(values.amount),
    contributionDate: values.contributionDate,
    note: values.note.trim(),
  }
}
