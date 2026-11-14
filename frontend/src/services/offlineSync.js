import {
  enqueueOfflineOperation,
  getOfflineMetadata,
  listOfflineOperations,
  removeOfflineOperation,
  setOfflineMetadata,
  updateOfflineOperation,
} from './offlineStorage.js'
import { getSyncStatus, pullSyncChanges, pushSyncOperations } from './syncApi.js'

const BATCH_SIZE = 50
const MAX_PULL_PAGES = 10
const RETRY_BASE_MS = 30_000
const RETRY_MAX_MS = 15 * 60_000
const locks = new Map()

export { listOfflineOperations }

export const syncQueueKey = (userId) => ['sync', 'queue', userId]
export const syncRuntimeKey = (userId) => ['sync', 'runtime', userId]
export const syncServerStatusKey = (userId) => ['sync', 'server-status', userId]

function publish(queryClient, userId, state, extra = {}) {
  queryClient.setQueryData(syncRuntimeKey(userId), {
    state,
    updatedAt: new Date().toISOString(),
    ...extra,
  })
}

async function refreshQueries(queryClient, userId) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: syncQueueKey(userId) }),
    queryClient.invalidateQueries({ queryKey: ['transactions'] }),
    queryClient.invalidateQueries({ queryKey: ['wallets'] }),
    queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    queryClient.invalidateQueries({ queryKey: ['budgets'] }),
  ])
}

function isAuthenticationError(error) {
  return [401, 403].includes(error?.response?.status)
}

function isTemporaryError(error) {
  const status = error?.response?.status
  return !status || status === 408 || status === 429 || status >= 500
}

function retryDelay(retryCount) {
  return Math.min(RETRY_BASE_MS * (2 ** Math.max(0, retryCount - 1)), RETRY_MAX_MS)
}

function isPermanentFailure(code, status) {
  return ['VALIDATION_ERROR', 'PAYLOAD_TOO_LARGE'].includes(code) ||
    (status >= 400 && status < 500 && ![408, 429].includes(status))
}

function backendOperation(record) {
  return record.operation
}

async function markBatchFailure(userId, records, error) {
  const authenticationRequired = isAuthenticationError(error)
  const temporary = isTemporaryError(error)
  await Promise.all(records.map((record) => updateOfflineOperation(userId, record.operation.clientOperationId, {
    status: authenticationRequired ? 'auth_required' : temporary ? 'pending' : 'attention',
    retryCount: record.retryCount + (temporary ? 1 : 0),
    nextRetryAt: temporary ? Date.now() + retryDelay(record.retryCount + 1) : 0,
    error: {
      code: error?.response?.data?.error?.code ?? (authenticationRequired ? 'AUTH_REQUIRED' : 'SYNC_REQUEST_FAILED'),
      message: authenticationRequired
        ? 'Sign in again before synchronizing this operation.'
        : temporary
          ? 'The server could not be reached. This operation remains queued.'
          : 'The server rejected this synchronization request.',
    },
  })))
}

async function applyBatchResults(userId, records, results) {
  const byIndex = new Map(results.map((result) => [result.index, result]))
  for (const [index, record] of records.entries()) {
    const result = byIndex.get(index)
    if (!result) {
      await updateOfflineOperation(userId, record.operation.clientOperationId, {
        status: 'pending',
        error: { code: 'MISSING_RESULT', message: 'No result was returned for this operation.' },
        retryCount: record.retryCount + 1,
        nextRetryAt: Date.now() + retryDelay(record.retryCount + 1),
      })
      continue
    }

    if (result.status === 'processed') {
      await removeOfflineOperation(userId, record.operation.clientOperationId)
      continue
    }

    if (result.status === 'conflict') {
      await updateOfflineOperation(userId, record.operation.clientOperationId, {
        status: 'conflict',
        nextRetryAt: 0,
        error: {
          code: result.conflict?.code ?? 'SYNC_CONFLICT',
          message: result.conflict?.message ?? 'This transaction conflicts with server data.',
          serverVersion: result.conflict?.serverVersion ?? null,
        },
      })
      continue
    }

    const code = result.error?.code ?? 'SYNC_FAILED'
    const status = isPermanentFailure(code, result.statusCode) ? 'attention' : 'pending'
    const retryCount = record.retryCount + (status === 'pending' ? 1 : 0)
    await updateOfflineOperation(userId, record.operation.clientOperationId, {
      status,
      retryCount,
      nextRetryAt: status === 'pending' ? Date.now() + retryDelay(retryCount) : 0,
      error: {
        code,
        message: result.error?.message ?? 'The operation could not be synchronized.',
      },
    })
  }
}

async function pullChanges(userId) {
  let cursor = await getOfflineMetadata(userId, 'pullCursor')
  let pages = 0
  let changeCount = 0
  let hasMore = true
  while (hasMore && pages < MAX_PULL_PAGES) {
    const result = await pullSyncChanges({ ...(cursor ? { cursor } : {}), limit: 100 })
    if (!Array.isArray(result.changes) || !result.pagination?.nextCursor) {
      throw new Error('The server returned an invalid synchronization page.')
    }
    changeCount += result.changes.length
    cursor = result.pagination.nextCursor
    await setOfflineMetadata(userId, 'pullCursor', cursor)
    hasMore = Boolean(result.pagination.hasMore)
    pages += 1
  }
  return { changeCount, hasMore }
}

async function runSync(userId, queryClient, force) {
  if (!globalThis.navigator?.onLine) {
    publish(queryClient, userId, 'offline')
    return { state: 'offline', processed: 0 }
  }
  publish(queryClient, userId, 'checking')
  let processed = 0
  try {
    const serverStatus = await getSyncStatus()
    queryClient.setQueryData(syncServerStatusKey(userId), serverStatus)
    let queue = await listOfflineOperations(userId)
    const authPaused = queue.filter((record) => record.status === 'auth_required')
    await Promise.all(authPaused.map((record) =>
      updateOfflineOperation(userId, record.operation.clientOperationId, {
        status: 'pending',
        nextRetryAt: 0,
        error: null,
      })
    ))
    if (authPaused.length) queue = await listOfflineOperations(userId)
    const pending = queue.filter((record) =>
      record.status === 'pending' && (force || record.nextRetryAt <= Date.now())
    )

    for (let offset = 0; offset < pending.length; offset += BATCH_SIZE) {
      const batch = pending.slice(offset, offset + BATCH_SIZE)
      await Promise.all(batch.map((record) =>
        updateOfflineOperation(userId, record.operation.clientOperationId, { status: 'syncing', error: null })
      ))
      publish(queryClient, userId, 'syncing', { pending: pending.length, processed })
      try {
        const response = await pushSyncOperations(batch.map(backendOperation))
        if (!Array.isArray(response.results)) throw new Error('The server returned an invalid synchronization result.')
        await applyBatchResults(userId, batch, response.results)
        processed += response.results.filter((result) => result.status === 'processed').length
      } catch (error) {
        await markBatchFailure(userId, batch, error)
        if (isAuthenticationError(error)) {
          publish(queryClient, userId, 'auth_required', { pending: pending.length, processed })
          await refreshQueries(queryClient, userId)
          return { state: 'auth_required', processed }
        }
        if (!isTemporaryError(error)) throw error
        publish(queryClient, userId, 'failed', { pending: pending.length, processed, message: error.message })
        await refreshQueries(queryClient, userId)
        return { state: 'failed', processed, error }
      }
    }

    const pull = await pullChanges(userId)
    const latestStatus = await getSyncStatus()
    queryClient.setQueryData(syncServerStatusKey(userId), latestStatus)
    const syncedAt = new Date().toISOString()
    await setOfflineMetadata(userId, 'lastSuccessfulSyncAt', syncedAt)
    await refreshQueries(queryClient, userId)
    const remaining = await listOfflineOperations(userId)
    const hasAttention = remaining.some((item) => ['conflict', 'attention', 'auth_required'].includes(item.status))
    const hasPending = remaining.some((item) => item.status === 'pending')
    const state = hasAttention ? 'attention' : hasPending ? 'pending' : 'synced'
    publish(queryClient, userId, state, {
      pending: remaining.length,
      processed,
      pulledChanges: pull.changeCount,
      moreToPull: pull.hasMore,
      lastSuccessfulSyncAt: syncedAt,
    })
    return { state, processed, pulledChanges: pull.changeCount, moreToPull: pull.hasMore }
  } catch (error) {
    const state = isAuthenticationError(error) ? 'auth_required' : isTemporaryError(error) ? 'unavailable' : 'failed'
    publish(queryClient, userId, state, { processed, message: error.message })
    await refreshQueries(queryClient, userId)
    return { state, processed, error }
  }
}

export function synchronizeUserQueue(userId, queryClient, { force = false } = {}) {
  if (!userId) return Promise.reject(new Error('A signed-in account is required to synchronize.'))
  const active = locks.get(userId)
  if (active) return active
  const promise = runSync(userId, queryClient, force).finally(() => {
    locks.delete(userId)
  })
  locks.set(userId, promise)
  return promise
}

export async function discardQueuedOperation(userId, clientOperationId, queryClient) {
  const removed = await removeOfflineOperation(userId, clientOperationId)
  if (removed) await queryClient.invalidateQueries({ queryKey: syncQueueKey(userId) })
  return removed
}

export async function saveTransactionOperation(userId, operation) {
  return enqueueOfflineOperation(userId, operation)
}

export async function getLastSuccessfulSyncAt(userId) {
  return getOfflineMetadata(userId, 'lastSuccessfulSyncAt')
}

export async function saveReferenceSnapshot(userId, name, value) {
  return setOfflineMetadata(userId, `references:${name}`, value)
}

export async function getReferenceSnapshot(userId, name) {
  return getOfflineMetadata(userId, `references:${name}`)
}
