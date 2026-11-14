import { describe, expect, it } from 'vitest'
import { transactionSummaryParams } from './transactionSummary.js'
import { datePresetRange } from '@/lib/transactionDates.js'

describe('transactionSummaryParams', () => {
  it('uses the existing monthly analytics summary and wallet/category filters by default', () => {
    expect(transactionSummaryParams(
      new URLSearchParams('walletId=wallet-id&categoryId=category-id'),
      'Asia/Kolkata',
    )).toEqual({
      filters: {
        timezone: 'Asia/Kolkata',
        walletId: 'wallet-id',
        categoryId: 'category-id',
        period: 'month',
      },
      label: 'This month',
    })
  })

  it('maps supported week and custom date ranges to the analytics endpoint', () => {
    expect(transactionSummaryParams(new URLSearchParams('datePreset=week'), 'Asia/Kolkata').filters)
      .toMatchObject({ period: 'week', timezone: 'Asia/Kolkata' })
    expect(transactionSummaryParams(new URLSearchParams('datePreset=year'), 'Asia/Kolkata').filters)
      .toMatchObject({ period: 'year', timezone: 'Asia/Kolkata' })

    expect(transactionSummaryParams(
      new URLSearchParams('datePreset=custom&fromDate=2026-10-01&toDate=2026-10-15'),
      'Asia/Kolkata',
    )).toEqual({
      filters: {
        timezone: 'Asia/Kolkata',
        period: 'custom',
        startDate: '2026-10-01',
        endDate: '2026-10-15',
      },
      label: 'Selected dates',
    })

  })

  it('uses the current local calendar year for the year filter', () => {
    expect(datePresetRange('year', 'Asia/Kolkata', new Date('2026-10-12T12:00:00.000Z'))).toEqual({
      from: '2025-12-31T18:30:00.000Z',
      to: '2026-10-12T18:29:59.999Z',
    })
  })

  it('uses the local date for today and waits for both custom dates', () => {
    expect(transactionSummaryParams(
      new URLSearchParams('datePreset=today'),
      'Asia/Kolkata',
      new Date('2026-10-01T20:00:00.000Z'),
    )).toEqual({
      filters: {
        timezone: 'Asia/Kolkata',
        period: 'custom',
        startDate: '2026-10-02',
        endDate: '2026-10-02',
      },
      label: 'Today',
    })

    expect(transactionSummaryParams(
      new URLSearchParams('datePreset=custom&fromDate=2026-10-01'),
      'Asia/Kolkata',
    )).toEqual({ filters: null, label: 'Selected dates' })
  })
})
