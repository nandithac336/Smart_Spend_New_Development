import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Categorization from './Categorization.jsx'
import { useCategories } from '@/hooks/useCategories.js'
import { useCategorySuggestions } from '@/hooks/useCategorySuggestions.js'
import { useCategorizationMutations } from '@/hooks/useCategorizationMutations.js'

vi.mock('@/hooks/useAuth.js', () => ({ useAuth: () => ({ user: { timezone: 'Asia/Kolkata' } }) }))
vi.mock('@/hooks/useCategories.js', () => ({ useCategories: vi.fn() }))
vi.mock('@/hooks/useCategorySuggestions.js', () => ({ useCategorySuggestions: vi.fn() }))
vi.mock('@/hooks/useCategorizationMutations.js', () => ({ useCategorizationMutations: vi.fn() }))

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <Categorization />
    </QueryClientProvider>,
  )
}

describe('Categorization page', () => {
  beforeEach(() => {
    useCategories.mockReturnValue({ data: [], isSuccess: true, isError: false, isLoading: false, refetch: vi.fn() })
    useCategorySuggestions.mockReturnValue({
      data: { suggestions: [], pagination: { page: 1, total: 0, pages: 0 } },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    })
    useCategorizationMutations.mockReturnValue({
      accept: { isPending: false, mutateAsync: vi.fn() },
      reject: { isPending: false, mutateAsync: vi.fn() },
    })
  })
  afterEach(cleanup)

  it('shows a real empty state when there are no pending suggestions', () => {
    renderPage()
    expect(screen.getByRole('heading', { name: 'You’re all caught up' })).toBeInTheDocument()
  })

  it('shows a recoverable error when the suggestion list fails', () => {
    useCategorySuggestions.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: vi.fn(),
    })
    renderPage()
    expect(screen.getByRole('heading', { name: 'Couldn’t load category suggestions' })).toBeInTheDocument()
  })

  it('shows loading placeholders while suggestions are being fetched', () => {
    useCategorySuggestions.mockReturnValue({ data: undefined, isLoading: true, isError: false, refetch: vi.fn() })
    renderPage()
    expect(screen.getByRole('heading', { name: 'Transaction Categorization' })).toBeInTheDocument()
    expect(document.querySelector('[aria-busy="true"]')).toBeInTheDocument()
  })

  it('paginates through the backend-provided pages', () => {
    useCategorySuggestions.mockReturnValue({
      data: { suggestions: [{ _id: 's1', transactionId: 't1', transactionType: 'expense' }], pagination: { page: 1, total: 21, pages: 2 } },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    })
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(useCategorySuggestions).toHaveBeenLastCalledWith(2)
  })
})
