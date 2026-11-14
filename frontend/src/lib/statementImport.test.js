import { describe, expect, it } from 'vitest'
import { statementDraftPayload, statementDraftValues, validateStatementDraft } from './statementImport.js'

describe('statement import draft helpers', () => {
  it('converts parsed paise and instants to editable user-local values', () => {
    expect(statementDraftValues({
      txnDate: '2026-11-05T00:00:00.000Z',
      amountPaise: 12550,
      direction: 'debit',
      suggestedCategoryId: 'not-an-assignment',
    }, 'Asia/Kolkata')).toMatchObject({
      txnDate: '2026-11-05T05:30',
      amount: '125.50',
      direction: 'debit',
      categoryId: '',
    })
  })

  it('requires a valid date, exact positive paise, and transaction direction', () => {
    expect(validateStatementDraft({ txnDate: '2026-02-31T12:00', amount: '12.345', direction: '' }, 'Asia/Kolkata').errors)
      .toMatchObject({ txnDate: expect.any(String), amount: expect.any(String), direction: expect.any(String) })
    expect(validateStatementDraft({ txnDate: '2026-11-05T05:30', amount: '12.50', direction: 'credit' }, 'Asia/Kolkata'))
      .toMatchObject({ amountPaise: 1250, errors: {} })
  })

  it('sends date and money in the backend schema without inventing fields', () => {
    expect(statementDraftPayload({
      txnDate: '2026-11-05T05:30',
      description: ' Store ',
      amount: '12.50',
      direction: 'debit',
      categoryId: '',
    }, 'Asia/Kolkata')).toEqual({
      changes: {
        txnDate: '2026-11-05T00:00:00.000Z',
        description: 'Store',
        amountPaise: 1250,
        direction: 'debit',
        categoryId: null,
        reviewStatus: 'pending',
      },
    })
  })
})
