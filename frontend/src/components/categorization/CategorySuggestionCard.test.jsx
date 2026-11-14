import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CategorySuggestionCard from './CategorySuggestionCard.jsx'
import { getTransaction } from '@/services/transactionApi.js'

vi.mock('@/services/transactionApi.js', () => ({ getTransaction: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }))

const suggestion = {
  _id: 'suggestion-1',
  transactionId: 'transaction-1',
  transactionType: 'expense',
  detectedMerchant: 'Corner Cafe',
  suggestedCategoryId: { _id: 'category-food', name: 'Food', type: 'expense' },
  confidence: 0.84,
  confidenceLevel: 'high',
  source: 'ai',
  explanation: 'Merchant and description match dining purchases.',
  alternatives: [{ categoryId: 'category-home', confidence: 0.4 }],
}

const categories = [
  { _id: 'category-food', name: 'Food', type: 'expense' },
  { _id: 'category-home', name: 'Home', type: 'expense' },
  { _id: 'category-income', name: 'Salary', type: 'income' },
]

function renderCard(overrides = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const props = {
    suggestion,
    categories,
    busy: false,
    canAccept: true,
    timeZone: 'Asia/Kolkata',
    onAccept: vi.fn().mockResolvedValue(undefined),
    onReject: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
  render(
    <QueryClientProvider client={queryClient}>
      <CategorySuggestionCard {...props} />
    </QueryClientProvider>,
  )
  return props
}

describe('CategorySuggestionCard', () => {
  beforeEach(() => {
    getTransaction.mockReset().mockResolvedValue({
      _id: 'transaction-1',
      type: 'expense',
      amount: 1250,
      txnDate: '2026-10-12T10:00:00.000Z',
      merchant: 'Corner Cafe',
      note: 'Lunch',
      categoryId: null,
    })
  })
  afterEach(cleanup)

  it('shows backend confidence and transaction details, then accepts the suggestion explicitly', async () => {
    const props = renderCard()

    expect(await screen.findByText('Lunch')).toBeInTheDocument()
    expect(screen.getByText('84% confidence · high confidence')).toBeInTheDocument()
    expect(screen.getByText(/₹12\.5/)).toBeInTheDocument()
    expect(screen.getByText(/AI suggestion/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Accept suggestion' }))

    await waitFor(() => expect(props.onAccept).toHaveBeenCalledWith(suggestion, undefined))
  })

  it('allows choosing a different category manually', async () => {
    const props = renderCard()
    await screen.findByText('Lunch')

    fireEvent.change(screen.getByLabelText('Choose a category manually'), { target: { value: 'category-home' } })
    fireEvent.click(screen.getByRole('button', { name: 'Use selected category' }))

    await waitFor(() => expect(props.onAccept).toHaveBeenCalledWith(suggestion, 'category-home'))
  })

  it('does not display invented confidence and allows dismissing an unmatched suggestion', async () => {
    const noMatch = { ...suggestion, suggestedCategoryId: null, confidence: undefined, confidenceLevel: undefined, source: 'none' }
    const props = renderCard({ suggestion: noMatch })
    await screen.findByText('Lunch')

    expect(screen.getByText('No confident suggestion')).toBeInTheDocument()
    expect(screen.queryByText(/% confidence/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reject suggestion' }))
    await waitFor(() => expect(props.onReject).toHaveBeenCalledWith(noMatch))
  })

  it('shows an explicit message when the accept request fails', async () => {
    const props = renderCard()
    props.onAccept.mockRejectedValueOnce(new Error('request failed'))
    await screen.findByText('Lunch')

    fireEvent.click(screen.getByRole('button', { name: 'Accept suggestion' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not accept this category.')
  })

  it('keeps review disabled and offers retry when the transaction lookup fails', async () => {
    getTransaction.mockRejectedValueOnce(new Error('request failed'))
    renderCard()

    expect(await screen.findByRole('alert')).toHaveTextContent('Review is disabled to protect its existing category.')
    expect(screen.queryByRole('button', { name: 'Accept suggestion' })).not.toBeInTheDocument()
  })

  it('protects an already assigned transaction category and only allows dismissing the stale suggestion', async () => {
    getTransaction.mockResolvedValueOnce({
      _id: 'transaction-1',
      type: 'expense',
      categoryId: { _id: 'category-home', name: 'Home' },
    })
    const props = renderCard()

    expect(await screen.findByText(/Existing category “Home” is protected/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Accept suggestion' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss stale suggestion' }))
    await waitFor(() => expect(props.onReject).toHaveBeenCalledWith(suggestion))
  })
})
