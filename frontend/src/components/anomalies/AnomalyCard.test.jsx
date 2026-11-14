import { cleanup, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AnomalyCard from './AnomalyCard.jsx'

vi.mock('@/services/transactionApi.js', () => ({ getTransaction: vi.fn() }))

const anomaly = {
  _id: 'anomaly-1',
  anomalyType: 'unusual_merchant_amount',
  severity: 'high',
  score: 67,
  status: 'new',
  explanation: 'This amount is higher than your past amounts for this merchant.',
  suggestedAction: 'Review the transaction details.',
  detectedAt: '2026-11-10T12:00:00.000Z',
  transactionId: {
    _id: 'transaction-1',
    type: 'expense',
    amount: 425,
    merchant: 'Cafe',
    txnDate: '2026-11-09T12:00:00.000Z',
    walletId: { _id: 'wallet-1', name: 'Main wallet' },
    categoryId: { _id: 'category-1', name: 'Food', type: 'expense' },
  },
}

function renderCard(overrides = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const props = { anomaly, timeZone: 'Asia/Kolkata', busy: false, onUpdateStatus: vi.fn(), ...overrides }
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AnomalyCard {...props} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return props
}

describe('AnomalyCard', () => {
  afterEach(cleanup)

  it('shows backend score, explanation, real transaction values and non-fraud context', () => {
    renderCard()

    expect(screen.getByText('67')).toBeInTheDocument()
    expect(screen.getByText(/not a fraud probability/)).toBeInTheDocument()
    expect(screen.getByText(/This amount is higher than your past amounts/)).toBeInTheDocument()
    expect(screen.getByText('Cafe')).toBeInTheDocument()
    expect(screen.getByText(/Food/)).toBeInTheDocument()
    expect(screen.getByText(/Main wallet/)).toBeInTheDocument()
    expect(screen.getByText(/₹4\.25/)).toBeInTheDocument()
  })

  it('links to transactions filtered by the original transaction facts', () => {
    renderCard()

    const link = screen.getByRole('link', { name: /Find this transaction/ })
    const url = new URL(link.getAttribute('href'), 'http://localhost')
    expect(url.pathname).toBe('/transactions')
    expect(url.searchParams.get('type')).toBe('expense')
    expect(url.searchParams.get('q')).toBe('Cafe')
    expect(url.searchParams.get('walletId')).toBe('wallet-1')
    expect(url.searchParams.get('categoryId')).toBe('category-1')
    expect(url.searchParams.get('minAmount')).toBe('4.25')
    expect(url.searchParams.get('maxAmount')).toBe('4.25')
    expect(url.searchParams.get('from')).toContain('2026-11-08T18:30')
  })

  it('offers only backend-supported review and dismiss actions for a new anomaly', () => {
    const props = renderCard()
    screen.getByRole('button', { name: 'Mark reviewed' }).click()
    screen.getByRole('button', { name: 'Dismiss' }).click()

    expect(props.onUpdateStatus).toHaveBeenNthCalledWith(1, anomaly, 'reviewed')
    expect(props.onUpdateStatus).toHaveBeenNthCalledWith(2, anomaly, 'dismissed')
  })

  it('allows reopening a dismissed anomaly but not dismissing it again', () => {
    renderCard({ anomaly: { ...anomaly, status: 'dismissed' } })

    expect(screen.getByRole('button', { name: 'Reopen for review' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Dismiss' })).not.toBeInTheDocument()
  })
})
