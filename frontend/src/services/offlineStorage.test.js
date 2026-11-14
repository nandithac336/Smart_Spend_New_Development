import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import {
  enqueueOfflineOperation,
  getOfflineMetadata,
  listOfflineOperations,
  removeOfflineOperation,
  setOfflineMetadata,
  updateOfflineOperation,
} from './offlineStorage.js'

function createOperation(clientOperationId, overrides = {}) {
  return {
    clientOperationId,
    operationType: 'create',
    entityType: 'transaction',
    clientTimestamp: new Date().toISOString(),
    payload: { type: 'expense', amount: 1250, walletId: 'wallet-id' },
    ...overrides,
  }
}

describe('offline IndexedDB queue', () => {
  it('persists owner-scoped operations in order and returns an existing operation for an identical retry', async () => {
    const userA = `user-a-${crypto.randomUUID()}`
    const userB = `user-b-${crypto.randomUUID()}`
    const operationId = crypto.randomUUID()
    const operation = createOperation(operationId)

    const first = await enqueueOfflineOperation(userA, operation)
    const retry = await enqueueOfflineOperation(userA, operation)
    await enqueueOfflineOperation(userB, createOperation(operationId))

    expect(retry.id).toBe(first.id)
    expect(await listOfflineOperations(userA)).toEqual([first])
    expect(await listOfflineOperations(userB)).toHaveLength(1)
  })

  it('rejects reused IDs with different data and concurrent edits for one entity', async () => {
    const userId = `user-${crypto.randomUUID()}`
    const operationId = crypto.randomUUID()
    await enqueueOfflineOperation(userId, createOperation(operationId))
    await expect(enqueueOfflineOperation(userId, createOperation(operationId, {
      payload: { type: 'expense', amount: 9900, walletId: 'wallet-id' },
    }))).rejects.toThrow('already associated with different transaction data')

    const update = createOperation(crypto.randomUUID(), {
      operationType: 'update',
      entityId: 'transaction-1',
      payload: { amount: 2000 },
    })
    await enqueueOfflineOperation(userId, update)
    await expect(enqueueOfflineOperation(userId, {
      ...update,
      clientOperationId: crypto.randomUUID(),
      operationType: 'delete',
    })).rejects.toThrow('already waiting to synchronize')
  })

  it('updates and removes only the matching owner’s queued record', async () => {
    const userA = `user-a-${crypto.randomUUID()}`
    const userB = `user-b-${crypto.randomUUID()}`
    const operation = createOperation(crypto.randomUUID())
    await enqueueOfflineOperation(userA, operation)

    await updateOfflineOperation(userA, operation.clientOperationId, { status: 'attention' })
    expect((await listOfflineOperations(userA))[0].status).toBe('attention')
    expect(await removeOfflineOperation(userB, operation.clientOperationId)).toBe(false)
    expect(await listOfflineOperations(userA)).toHaveLength(1)
    expect(await removeOfflineOperation(userA, operation.clientOperationId)).toBe(true)
    expect(await listOfflineOperations(userA)).toHaveLength(0)
  })

  it('stores synchronization metadata separately for each authenticated account', async () => {
    const userA = `user-a-${crypto.randomUUID()}`
    const userB = `user-b-${crypto.randomUUID()}`
    await setOfflineMetadata(userA, 'pullCursor', 'cursor-a')
    await setOfflineMetadata(userB, 'pullCursor', 'cursor-b')

    await expect(getOfflineMetadata(userA, 'pullCursor')).resolves.toBe('cursor-a')
    await expect(getOfflineMetadata(userB, 'pullCursor')).resolves.toBe('cursor-b')
  })
})
