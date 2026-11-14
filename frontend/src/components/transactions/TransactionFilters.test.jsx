import { describe, expect, it } from 'vitest'
import {
  activeTransactionFilterCount,
  transactionFiltersFromParams,
} from './transactionFilterUtils.js'
import { dateOnlyRangeToIso } from '@/lib/transactionDates.js'

describe('transaction filter URL helpers', () => {
  it('converts rupee amounts to paise while preserving URL-backed filters', () => {
    const params = new URLSearchParams({
      type: 'expense',
      q: 'market',
      minAmount: '120.50',
      maxAmount: '500',
      tag: 'groceries',
    })

    expect(transactionFiltersFromParams(params)).toEqual({
      type: 'expense',
      q: 'market',
      minAmount: 12050,
      maxAmount: 50000,
      tag: 'groceries',
    })
    expect(activeTransactionFilterCount(params)).toBe(5)
  })

  it('converts custom date endpoints in the selected time zone', () => {
    const range = dateOnlyRangeToIso('2026-10-01', '2026-10-02', 'Asia/Kolkata')
    expect(range.from).toBe('2026-09-30T18:30:00.000Z')
    expect(range.to).toBe('2026-10-02T18:29:59.999Z')
  })

  it('counts this year as a date filter and submits the supported year preset', () => {
    const params = new URLSearchParams('datePreset=year')
    expect(transactionFiltersFromParams(params)).toEqual({})
    expect(activeTransactionFilterCount(params)).toBe(1)
  })
})
