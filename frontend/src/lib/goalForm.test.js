import { describe, expect, it } from 'vitest'
import { contributionPayload, goalPayload } from './goalForm.js'

describe('goal form payloads', () => {
  it('converts target amounts to paise without modifying saved amounts', () => {
    expect(goalPayload({
      name: 'New home',
      description: 'Deposit',
      targetAmount: '125,000.50',
      targetDate: '2027-10-01',
    })).toEqual({
      name: 'New home',
      description: 'Deposit',
      targetAmount: 12_500_050,
      targetDate: '2027-10-01',
    })
  })

  it('records a contribution in paise with a calendar date and note', () => {
    expect(contributionPayload({
      amount: '250.75',
      contributionDate: '2026-11-09',
      note: ' Monthly savings ',
    })).toEqual({
      amount: 25_075,
      contributionDate: '2026-11-09',
      note: 'Monthly savings',
    })
  })
})
