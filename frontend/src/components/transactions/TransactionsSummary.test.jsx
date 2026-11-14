import { createElement } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import TransactionsSummary from './TransactionsSummary.jsx'
import { getTransactionSummary } from '@/services/analyticsApi.js'

vi.mock('@/services/analyticsApi.js', () => ({
  getTransactionSummary: vi.fn(),
}))

describe('TransactionsSummary', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('loads real summary totals for the active period and supported wallet filters', async () => {
    getTransactionSummary.mockResolvedValue({
      income: 200000,
      expense: 7540,
      netSavings: 192460,
    })
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }) => createElement(QueryClientProvider, { client: queryClient }, children)

    render(
      <TransactionsSummary
        searchParams={new URLSearchParams('datePreset=week&walletId=wallet-1')}
        timeZone="Asia/Kolkata"
      />,
      { wrapper },
    )

    expect(await screen.findByText('₹2,000')).toBeTruthy()
    expect(screen.getByText('₹75.4')).toBeTruthy()
    expect(screen.getByText('₹1,924.6')).toBeTruthy()
    await waitFor(() => expect(getTransactionSummary).toHaveBeenCalledWith({
      timezone: 'Asia/Kolkata',
      walletId: 'wallet-1',
      period: 'week',
    }))
    queryClient.clear()
  })

  it('does not request a custom summary until both dates are selected', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }) => createElement(QueryClientProvider, { client: queryClient }, children)
    render(
      <TransactionsSummary
        searchParams={new URLSearchParams('datePreset=custom&fromDate=2026-10-01')}
        timeZone="Asia/Kolkata"
      />,
      { wrapper },
    )

    expect(screen.getByText('Select both dates to view a summary for this range.')).toBeTruthy()
    expect(getTransactionSummary).not.toHaveBeenCalled()
    queryClient.clear()
  })
})
