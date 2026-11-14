import { createElement } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listTransactions } from '@/services/transactionApi.js'
import { useTransactions } from './useTransactions.js'

vi.mock('@/services/transactionApi.js', () => ({
  listTransactions: vi.fn(),
}))

describe('useTransactions', () => {
  let queryClient
  let wrapper

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    wrapper = ({ children }) => createElement(QueryClientProvider, { client: queryClient }, children)
  })

  it('requests later pages from the API pagination metadata', async () => {
    listTransactions
      .mockResolvedValueOnce({ data: [{ id: 'first' }], pagination: { page: 1, pages: 2, total: 2 } })
      .mockResolvedValueOnce({ data: [{ id: 'second' }], pagination: { page: 2, pages: 2, total: 2 } })

    const { result } = renderHook(() => useTransactions({ type: 'expense' }), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.hasNextPage).toBe(true)

    await act(() => result.current.fetchNextPage())

    expect(listTransactions).toHaveBeenNthCalledWith(1, { type: 'expense', page: 1, limit: 20 })
    expect(listTransactions).toHaveBeenNthCalledWith(2, { type: 'expense', page: 2, limit: 20 })
    await waitFor(() => expect(result.current.data.pages).toHaveLength(2))
    expect(result.current.data.pages.flatMap(({ data }) => data.map(({ id }) => id))).toEqual(['first', 'second'])
  })
})
