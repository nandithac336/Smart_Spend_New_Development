import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import TransactionItem from './TransactionItem.jsx'

const baseTransaction = {
  id: 'transaction-1',
  type: 'expense',
  amount: 1500,
  categoryId: { name: 'Education', icon: '📚' },
  walletId: { name: 'Daily wallet' },
  txnDate: '2026-10-12T10:15:00.000Z',
}

describe('TransactionItem', () => {
  afterEach(cleanup)

  it('uses the merchant as the title and shows category, wallet and transaction date', () => {
    render(<TransactionItem transaction={{ ...baseTransaction, merchant: 'Buying books', note: 'Semester reading' }} />)

    expect(screen.getByText('Buying books')).toBeTruthy()
    expect(screen.getByText(/Education · Daily wallet/)).toBeTruthy()
  })

  it('uses the note when no merchant is present', () => {
    render(<TransactionItem transaction={{ ...baseTransaction, note: 'Buying books' }} />)

    expect(screen.getByText('Buying books')).toBeTruthy()
    expect(screen.getByText(/Education · Daily wallet/)).toBeTruthy()
  })

  it('falls back to the category and then a sensible generic title', () => {
    const { rerender } = render(<TransactionItem transaction={baseTransaction} />)
    expect(screen.getByText('Education')).toBeTruthy()

    rerender(<TransactionItem transaction={{ ...baseTransaction, categoryId: null }} />)
    expect(screen.getByText('Uncategorized')).toBeTruthy()
  })
})
