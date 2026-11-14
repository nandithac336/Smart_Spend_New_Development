import { createElement } from 'react'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useWalletMutations } from './useWalletMutations.js'

const walletApi = vi.hoisted(() => ({
  archiveWallet: vi.fn(),
  createWallet: vi.fn(),
  transferBetweenWallets: vi.fn(),
  updateWallet: vi.fn(),
}))
const walletQueries = vi.hoisted(() => ({
  wallets: vi.fn(),
  transactions: vi.fn(),
  dashboard: vi.fn(),
}))

vi.mock('@/services/walletApi.js', () => walletApi)
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

function ActiveWalletQueries() {
  useQuery({ queryKey: ['wallets'], queryFn: walletQueries.wallets })
  useQuery({ queryKey: ['transactions'], queryFn: walletQueries.transactions })
  useQuery({ queryKey: ['dashboard'], queryFn: walletQueries.dashboard })
  return null
}

describe('useWalletMutations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    walletApi.transferBetweenWallets.mockResolvedValue({})
    walletQueries.wallets.mockResolvedValue({ totalBalance: 100 })
    walletQueries.transactions.mockResolvedValue([])
    walletQueries.dashboard.mockResolvedValue({})
  })

  it('refreshes wallet balances, transaction activity and dashboard after transfer', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    })
    function wrapper({ children }) {
      return createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(ActiveWalletQueries),
        children,
      )
    }

    const { result } = renderHook(() => useWalletMutations(), { wrapper })
    await waitFor(() => expect(walletQueries.wallets).toHaveBeenCalledOnce())
    walletQueries.wallets.mockResolvedValue({ totalBalance: 75 })

    await act(async () => {
      await result.current.transfer.mutateAsync({
        fromWalletId: 'cash-id',
        toWalletId: 'bank-id',
        amount: 2500,
      })
    })

    await waitFor(() => expect(walletQueries.wallets).toHaveBeenCalledTimes(2))
    expect(queryClient.getQueryData(['wallets'])).toEqual({ totalBalance: 75 })
    expect(walletQueries.transactions).toHaveBeenCalledTimes(2)
    expect(walletQueries.dashboard).toHaveBeenCalledTimes(2)
    queryClient.clear()
  })
})
