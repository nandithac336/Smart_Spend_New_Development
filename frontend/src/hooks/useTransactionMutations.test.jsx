import { createElement } from 'react'
import { act, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import {
  deleteTransaction,
  restoreTransaction,
  updateTransaction,
} from '@/services/transactionApi.js'
import {
  listOfflineOperations,
  saveTransactionOperation,
  syncQueueKey,
} from '@/services/offlineSync.js'
import { pushSyncOperations } from '@/services/syncApi.js'
import { useTransactionMutations } from './useTransactionMutations.js'

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))
vi.mock('@/hooks/useAuth.js', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }))
vi.mock('@/services/offlineSync.js', () => ({
  listOfflineOperations: vi.fn(),
  saveTransactionOperation: vi.fn(),
  syncQueueKey: (userId) => ['sync', 'queue', userId],
}))
vi.mock('@/services/syncApi.js', () => ({ pushSyncOperations: vi.fn() }))
vi.mock('@/services/transactionApi.js', () => ({
  deleteTransaction: vi.fn(),
  restoreTransaction: vi.fn(),
  updateTransaction: vi.fn(),
}))

describe('useTransactionMutations', () => {
  let queryClient
  let invalidate
  let wrapper

  beforeEach(() => {
    vi.clearAllMocks()
    onlineManager.setOnline(true)
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
    saveTransactionOperation.mockResolvedValue({})
    listOfflineOperations.mockResolvedValue([])
    pushSyncOperations.mockResolvedValue({ results: [{ status: 'processed', data: {} }] })
    queryClient = new QueryClient()
    invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue()
    wrapper = ({ children }) => createElement(QueryClientProvider, { client: queryClient }, children)
  })

  afterEach(() => {
    onlineManager.setOnline(true)
  })

  it('invalidates transactions, wallets, and dashboard after every mutation', async () => {
    updateTransaction.mockResolvedValue({})
    deleteTransaction.mockResolvedValue({})
    restoreTransaction.mockResolvedValue({})
    const { result } = renderHook(() => useTransactionMutations(), { wrapper })
    const calls = [
      () => result.current.create.mutateAsync({}),
      () => result.current.update.mutateAsync({ id: 'id', payload: {} }),
      () => result.current.remove.mutateAsync('id'),
      () => result.current.restore.mutateAsync('id'),
    ]

    for (const run of calls) {
      await act(run)
    }

    expect(invalidate).toHaveBeenCalledTimes(20)
    expect(invalidate.mock.calls.map(([options]) => options.queryKey)).toEqual([
      ['transactions'], ['wallets'], ['dashboard'], ['budgets'], ['sync', 'queue'],
      ['transactions'], ['wallets'], ['dashboard'], ['budgets'], ['sync', 'queue'],
      ['transactions'], ['wallets'], ['dashboard'], ['budgets'], ['sync', 'queue'],
      ['transactions'], ['wallets'], ['dashboard'], ['budgets'], ['sync', 'queue'],
    ])
  })

  it('shows the API error message in a toast when a mutation fails', async () => {
    pushSyncOperations.mockRejectedValue({
      response: { status: 400, data: { error: { message: 'Wallet not found' } } },
    })
    const { result } = renderHook(() => useTransactionMutations(), { wrapper })

    await act(async () => {
      await expect(result.current.create.mutateAsync({})).rejects.toMatchObject({
        response: { status: 400, data: { error: { message: 'Wallet not found' } } },
      })
    })

    expect(toast.error).toHaveBeenCalledWith('Wallet not found')
  })

  it('queues an offline create under the signed-in user and preserves the form client ID', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    onlineManager.setOnline(false)
    const { result } = renderHook(() => useTransactionMutations(), { wrapper })
    const payload = {
      type: 'expense',
      amount: 1250,
      walletId: 'wallet-1',
      clientId: 'a4b91740-2c12-4f97-9d98-b4fda4402222',
    }
    const queued = {
      id: `user-1:${payload.clientId}`,
      userId: 'user-1',
      operation: {
        clientOperationId: payload.clientId,
        operationType: 'create',
        entityType: 'transaction',
        payload: { type: 'expense', amount: 1250, walletId: 'wallet-1' },
      },
      status: 'pending',
    }
    listOfflineOperations.mockResolvedValue([queued])

    let response
    await act(async () => {
      response = await result.current.create.mutateAsync(payload)
    })
    expect(response).toMatchObject({ pendingSync: true })
    expect(pushSyncOperations).not.toHaveBeenCalled()
    expect(saveTransactionOperation).toHaveBeenCalledWith('user-1', expect.objectContaining({
      clientOperationId: payload.clientId,
      operationType: 'create',
      entityType: 'transaction',
      payload: { type: 'expense', amount: 1250, walletId: 'wallet-1' },
    }))
    expect(invalidate.mock.calls.every(([options]) => options.refetchType === 'none')).toBe(true)
    expect(queryClient.getQueryData(syncQueueKey('user-1'))).toEqual([queued])
  })

  it('queues an update only with the server version and does not queue validation errors', async () => {
    const transaction = { id: 'transaction-1', updatedAt: '2026-11-12T10:00:00.000Z' }
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    const { result } = renderHook(() => useTransactionMutations(), { wrapper })
    await act(() => result.current.update.mutateAsync({
      id: transaction.id,
      payload: { amount: 2000 },
      transaction,
    }))
    expect(saveTransactionOperation).toHaveBeenCalledWith('user-1', expect.objectContaining({
      operationType: 'update',
      entityId: transaction.id,
      baseUpdatedAt: transaction.updatedAt,
    }))

    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
    updateTransaction.mockRejectedValueOnce({
      response: { status: 400, data: { error: { message: 'Invalid amount' } } },
    })
    await expect(act(() => result.current.update.mutateAsync({
      id: transaction.id,
      payload: { amount: -1 },
      transaction,
    }))).rejects.toMatchObject({ response: { status: 400 } })
    expect(saveTransactionOperation).toHaveBeenCalledOnce()
  })
})
