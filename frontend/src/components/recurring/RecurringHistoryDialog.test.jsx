import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import RecurringHistoryDialog from './RecurringHistoryDialog.jsx'

afterEach(cleanup)

describe('RecurringHistoryDialog', () => {
  it('keeps schedule data distinct from generated transactions and shows history', () => {
    render(
      <RecurringHistoryDialog
        onClose={vi.fn()}
        query={{
          data: [{
            id: 'transaction-1',
            merchant: 'Monthly rent',
            type: 'expense',
            amount: 125_050,
            txnDate: '2026-11-05T18:30:00.000Z',
            status: 'confirmed',
          }],
          isPending: false,
          isError: false,
        }}
        schedule={{ name: 'Monthly rent' }}
        timeZone="Asia/Kolkata"
      />,
    )
    expect(screen.getByText(/Confirmed transactions already generated/)).toBeInTheDocument()
    expect(screen.getByText('Monthly rent')).toBeInTheDocument()
    expect(screen.getByText('−₹1,250.5')).toBeInTheDocument()
  })

  it('shows empty, loading, and retryable error states', async () => {
    const refetch = vi.fn()
    const { rerender } = render(
      <RecurringHistoryDialog onClose={vi.fn()} query={{ data: [], isPending: false, isError: false }} schedule={{ name: 'Rent' }} timeZone="Asia/Kolkata" />,
    )
    expect(screen.getByText('Nothing generated yet')).toBeInTheDocument()

    rerender(
      <RecurringHistoryDialog onClose={vi.fn()} query={{ data: undefined, isPending: true, isError: false }} schedule={{ name: 'Rent' }} timeZone="Asia/Kolkata" />,
    )
    expect(screen.getByLabelText('Loading generated transactions')).toBeInTheDocument()

    rerender(
      <RecurringHistoryDialog onClose={vi.fn()} query={{ data: undefined, isPending: false, isError: true, refetch }} schedule={{ name: 'Rent' }} timeZone="Asia/Kolkata" />,
    )
    screen.getByRole('button', { name: 'Retry' }).click()
    expect(refetch).toHaveBeenCalledOnce()
  })
})
