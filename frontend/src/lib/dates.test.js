import { describe, expect, it } from 'vitest'
import { groupByDay } from './dates.js'

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
