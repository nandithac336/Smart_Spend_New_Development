import { describe, expect, it } from 'vitest'
import { recurringFormSchema, recurringPayload } from './recurringForm.js'
import { formatScheduleDate, scheduleCalendarDate, todayInTimeZone } from './recurringDates.js'

describe('recurring date and form helpers', () => {
  it('keeps schedule calendar dates on the UTC-midnight date-only encoding', () => {
    expect(scheduleCalendarDate('2026-11-05T00:00:00.000Z')).toBe('2026-11-05')
    expect(formatScheduleDate('2026-11-05T00:00:00.000Z')).toBe('5 Nov 2026')
    expect(todayInTimeZone('Asia/Kolkata', new Date('2026-11-08T19:00:00.000Z'))).toBe('2026-11-09')
  })

  it('validates required schedule fields and ordered optional end dates', () => {
    const values = {
      name: 'Monthly rent',
      type: 'expense',
      amount: '1250.50',
      walletId: 'wallet-id',
      categoryId: '',
      description: '',
      frequency: 'monthly',
      startDate: '2026-11-05',
      endDate: '2026-12-01',
    }
    expect(recurringFormSchema.safeParse(values).success).toBe(true)
    expect(recurringFormSchema.safeParse({ ...values, endDate: '2026-11-04' }).success).toBe(false)
    expect(recurringFormSchema.safeParse({ ...values, amount: '1.234' }).success).toBe(false)
    expect(recurringFormSchema.safeParse({ ...values, walletId: '' }).success).toBe(false)
  })

  it('converts money to paise and sends only changed values for edits', () => {
    const schedule = {
      id: 'schedule-1',
      name: 'Monthly rent',
      type: 'expense',
      amount: 125_050,
      walletId: { id: 'wallet-id' },
      categoryId: { id: 'category-id' },
      description: 'Apartment',
      frequency: 'monthly',
      startDate: '2026-11-05T00:00:00.000Z',
      nextDueDate: '2026-11-05T00:00:00.000Z',
      endDate: null,
    }
    const values = {
      name: 'Monthly rent',
      type: 'expense',
      amount: '1300.00',
      walletId: 'wallet-id',
      categoryId: 'category-id',
      description: 'Apartment',
      frequency: 'monthly',
      startDate: '2026-11-05',
      endDate: '',
    }
    expect(recurringPayload(values, schedule)).toEqual({ amount: 130_000 })
    expect(recurringPayload(values)).toMatchObject({
      amount: 130_000,
      startDate: '2026-11-05',
      endDate: null,
    })
  })
})
