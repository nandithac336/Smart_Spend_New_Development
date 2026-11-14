import { createElement } from 'react'
import { act, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { archiveBudget, createBudget, updateBudget } from '@/services/budgetApi.js'
import { useBudgetMutations } from './useBudgetMutations.js'

vi.mock('@/services/budgetApi.js', () => ({
  archiveBudget: vi.fn(),
  createBudget: vi.fn(),
  updateBudget: vi.fn(),
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

describe('useBudgetMutations', () => {
  let queryClient
  let invalidate
  let wrapper

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient()
    invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue()
    wrapper = ({ children }) => createElement(QueryClientProvider, { client: queryClient }, children)
  })

  it('refreshes budget data after create, edit, and archive', async () => {
    createBudget.mockResolvedValue({})
    updateBudget.mockResolvedValue({})
    archiveBudget.mockResolvedValue({})
    const { result } = renderHook(() => useBudgetMutations(), { wrapper })

    await act(async () => {
      await result.current.create.mutateAsync({})
      await result.current.update.mutateAsync({ id: 'budget-1', payload: {} })
      await result.current.archive.mutateAsync('budget-1')
    })

    expect(invalidate).toHaveBeenCalledTimes(3)
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['budgets'] })
  })
})
