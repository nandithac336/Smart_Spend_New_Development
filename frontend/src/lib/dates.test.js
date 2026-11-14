import { describe, expect, it } from 'vitest'
import { formatTxnDate, formatTxnTime, groupByDay } from './dates.js'

describe('transaction date formatters', () => {
  const now = new Date('2026-10-14T12:00:00.000Z')

  it('formats Today, Yesterday and dated labels in Asia/Kolkata', () => {
    expect(formatTxnDate('2026-10-14T10:15:00.000Z', { timeZone: 'Asia/Kolkata', now }))
      .toBe('Today, 3:45 pm')
    expect(formatTxnDate('2026-10-13T10:15:00.000Z', { timeZone: 'Asia/Kolkata', now }))
      .toBe('Yesterday, 3:45 pm')
    expect(formatTxnDate('2026-10-12T10:15:00.000Z', { timeZone: 'Asia/Kolkata', now }))
      .toBe('12 Oct 2026, 3:45 pm')
  })

  it('formats a transaction time in the requested timezone', () => {
    expect(formatTxnTime('2026-10-14T10:15:00.000Z', 'Asia/Kolkata')).toBe('3:45 pm')
  })
})

describe('groupByDay', () => {
  it('labels dates as Today and Yesterday in Asia/Kolkata', () => {
    const items = [
      { id: 'today', txnDate: '2024-01-01T18:30:00.000Z' },
      { id: 'yesterday', txnDate: '2024-01-01T17:00:00.000Z' },
    ]
    const groups = groupByDay(items, { now: new Date('2024-01-02T01:30:00.000Z') })

    expect(groups.map(({ label }) => label)).toEqual(['Today', 'Yesterday'])
    expect(groups.map(({ items: grouped }) => grouped[0].id)).toEqual(['today', 'yesterday'])
  })
})
