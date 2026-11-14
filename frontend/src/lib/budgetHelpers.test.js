import { describe, expect, it } from 'vitest'
import { budgetsForMonth, currentMonthInTimeZone, getBudgetTotals, makeBudgetPayload } from './budgetHelpers.js'
import { toPaise } from './money.js'
import { budgetFormSchema } from './budgetForm.js'

describe('budget helpers', () => {
  it('uses the selected month and includes budgets whose date ranges overlap it', () => {
    const budgets = [
      { startDate: '2026-11-01T00:00:00.000Z', endDate: '2026-11-30T00:00:00.000Z' },
      { startDate: '2026-10-28T00:00:00.000Z', endDate: '2026-11-03T00:00:00.000Z' },
      { startDate: '2026-12-01T00:00:00.000Z', endDate: '2026-12-31T00:00:00.000Z' },
    ]

    expect(budgetsForMonth(budgets, '2026-11')).toEqual(budgets.slice(0, 2))
    expect(currentMonthInTimeZone('Asia/Kolkata', new Date('2026-10-31T20:00:00.000Z'))).toBe('2026-11')
  })

  it('builds supported period payloads with integer-paise amounts', () => {
    expect(makeBudgetPayload({
      name: 'Food',
      amount: '1,200.50',
      categoryId: 'category-id',
      period: 'monthly',
      month: '2026-11',
    }, toPaise)).toEqual({
      name: 'Food',
      amount: 120050,
      categoryId: 'category-id',
      period: 'monthly',
      startDate: '2026-11-01',
      endDate: '2026-11-30',
    })
    expect(makeBudgetPayload({
      name: 'Weekly',
      amount: '500',
      categoryId: '',
      period: 'weekly',
      weekStart: '2026-11-02',
    }, toPaise)).toMatchObject({
      amount: 50000,
      startDate: '2026-11-02',
      endDate: '2026-11-08',
    })
  })

  it('adds allocated, spent, and remaining amounts from backend progress', () => {
    expect(getBudgetTotals([
      { amount: 10_000, progress: { budgetAmount: 10_000, actualSpending: 8_000, remainingAmount: 2_000 } },
      { amount: 20_000, progress: { budgetAmount: 20_000, actualSpending: 22_000, remainingAmount: -2_000 } },
    ])).toEqual({ allocated: 30_000, spent: 30_000, remaining: 0 })
  })

  it('rejects invalid monthly values and non-Monday weekly starts', () => {
    const base = {
      name: 'Food',
      amount: '100',
      categoryId: '',
      period: 'monthly',
      month: '2026-13',
      weekStart: '2026-11-02',
      year: '2026',
      customStart: '2026-11-01',
      customEnd: '2026-11-30',
    }
    expect(budgetFormSchema.safeParse(base).success).toBe(false)
    expect(budgetFormSchema.safeParse({ ...base, period: 'weekly', weekStart: '2026-11-03' }).success).toBe(false)
  })
})
