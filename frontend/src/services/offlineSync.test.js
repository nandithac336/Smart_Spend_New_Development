import 'fake-indexeddb/auto'
import { QueryClient } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { enqueueOfflineOperation, listOfflineOperations } from './offlineStorage.js'
import { getSyncStatus, pullSyncChanges, pushSyncOperations } from './syncApi.js'
import { syncRuntimeKey, synchronizeUserQueue } from './offlineSync.js'

vi.mock('./syncApi.js', () => ({
  getSyncStatus: vi.fn(),
  pullSyncChanges: vi.fn(),
  pushSyncOperations: vi.fn(),
}))

function operation(userId, overrides = {}) {
  const record = {
    clientOperationId: crypto.randomUUID(),
    operationType: 'create',
    entityType: 'transaction',
    clientTimestamp: new Date().toISOString(),
    payload: { type: 'expense', amount: 1200, walletId: 'wallet-id' },
    ...overrides,
  }
  return enqueueOfflineOperation(userId, record).then(() => record)
}

describe('offline synchronization service', () => {
  let queryClient

  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
    getSyncStatus.mockResolvedValue({ latestChangeAt: null, processedOperations: 0, conflictedOperations: 0 })
    pullSyncChanges.mockResolvedValue({
      changes: [],
      pagination: { hasMore: false, nextCursor: 'cursor-complete' },
    })
    queryClient = new QueryClient()
  })

  it('keeps the operation ID until the server confirms processing and records a cursor', async () => {
    const userId = `sync-user-${crypto.randomUUID()}`
    const queued = await operation(userId)
    pushSyncOperations.mockImplementation(async (batch) => ({
      results: batch.map((item, index) => ({ index, status: 'processed', clientOperationId: item.clientOperationId })),
    }))

    const result = await synchronizeUserQueue(userId, queryClient)

    expect(result.state).toBe('synced')
    expect(pushSyncOperations).toHaveBeenCalledWith([expect.objectContaining({ clientOperationId: queued.clientOperationId })])
    expect(await listOfflineOperations(userId)).toEqual([])
    expect(queryClient.getQueryData(syncRuntimeKey(userId)).state).toBe('synced')
  })

  it('retains the same operation ID and applies backoff after a network failure', async () => {
    const userId = `sync-user-${crypto.randomUUID()}`
    const queued = await operation(userId)
    pushSyncOperations.mockRejectedValue(new Error('offline'))

    const result = await synchronizeUserQueue(userId, queryClient)
    const [remaining] = await listOfflineOperations(userId)

    expect(result.state).toBe('failed')
    expect(remaining.operation.clientOperationId).toBe(queued.clientOperationId)
    expect(remaining.status).toBe('pending')
    expect(remaining.retryCount).toBe(1)
    expect(remaining.nextRetryAt).toBeGreaterThan(Date.now())
    pushSyncOperations.mockImplementationOnce(async (batch) => ({
      results: batch.map((item, index) => ({ index, status: 'processed', duplicate: true })),
    }))
    expect((await synchronizeUserQueue(userId, queryClient, { force: true })).state).toBe('synced')
    expect(pushSyncOperations.mock.calls[1][0][0].clientOperationId).toBe(queued.clientOperationId)
    expect(await listOfflineOperations(userId)).toHaveLength(0)
  })

  it('preserves conflicts and permanent validation failures for user review', async () => {
    const userId = `sync-user-${crypto.randomUUID()}`
    const conflict = await operation(userId)
    const invalid = await operation(userId)
    const ordered = await listOfflineOperations(userId)
    pushSyncOperations.mockResolvedValue({
      results: ordered.map((record, index) => ({
        index,
        ...(record.operation.clientOperationId === conflict.clientOperationId
          ? { status: 'conflict', conflict: { code: 'stale_update', message: 'Server version changed' } }
          : { status: 'failed', error: { code: 'VALIDATION_ERROR', message: 'Wallet unavailable' } }),
      })),
    })

    const result = await synchronizeUserQueue(userId, queryClient)
    const queue = await listOfflineOperations(userId)

    expect(result.state).toBe('attention')
    expect(queue.find((item) => item.operation.clientOperationId === conflict.clientOperationId)).toMatchObject({
      status: 'conflict',
      error: { code: 'stale_update', message: 'Server version changed' },
    })
    expect(queue.find((item) => item.operation.clientOperationId === invalid.clientOperationId)).toMatchObject({
      status: 'attention',
      error: { code: 'VALIDATION_ERROR' },
    })
  })

  it('does not send another user’s operations and shares one in-flight synchronization', async () => {
    const ownerA = `sync-user-a-${crypto.randomUUID()}`
    const ownerB = `sync-user-b-${crypto.randomUUID()}`
    await operation(ownerA)
    await operation(ownerB)
    let finishPush
    pushSyncOperations.mockImplementation(() => new Promise((resolve) => { finishPush = resolve }))

    const first = synchronizeUserQueue(ownerA, queryClient)
    const second = synchronizeUserQueue(ownerA, queryClient)
    await vi.waitFor(() => expect(pushSyncOperations).toHaveBeenCalledOnce())
    expect(pushSyncOperations.mock.calls[0][0]).toHaveLength(1)
    expect(second).toBe(first)
    finishPush({ results: [{ index: 0, status: 'processed' }] })
    await Promise.all([first, second])
    expect(await listOfflineOperations(ownerB)).toHaveLength(1)
  })

  it('pauses on expired authentication and safely resumes the same operation after reauthentication', async () => {
    const userId = `sync-user-${crypto.randomUUID()}`
    const queued = await operation(userId)
    pushSyncOperations.mockRejectedValueOnce({ response: { status: 401 } })
      .mockImplementationOnce(async (batch) => ({
        results: batch.map((item, index) => ({ index, status: 'processed', clientOperationId: item.clientOperationId })),
      }))

    expect((await synchronizeUserQueue(userId, queryClient)).state).toBe('auth_required')
    expect((await listOfflineOperations(userId))[0].status).toBe('auth_required')
    expect((await synchronizeUserQueue(userId, queryClient)).state).toBe('synced')
    expect(pushSyncOperations.mock.calls[1][0][0].clientOperationId).toBe(queued.clientOperationId)
  })
})
