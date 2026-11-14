import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  deleteTransaction,
  restoreTransaction,
  updateTransaction,
} from '@/services/transactionApi.js'
import { getErrorMessage } from '@/lib/errors.js'
import { useAuth } from '@/hooks/useAuth.js'
import { pushSyncOperations } from '@/services/syncApi.js'
import {
  listOfflineOperations,
  saveTransactionOperation,
  syncQueueKey,
} from '@/services/offlineSync.js'

export function useTransactionMutations() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const userId = user?.id ?? user?._id

  function isQueueableNetworkError(error) {
    const status = error?.response?.status
    return globalThis.navigator?.onLine === false ||
      !status ||
      status === 408 ||
      status === 429 ||
      status >= 500
  }

  async function queueOperation(operation) {
    await saveTransactionOperation(userId, operation)
    return { pendingSync: true, clientOperationId: operation.clientOperationId }
  }

  async function createOrQueue(payload) {
    const clientOperationId = payload.clientId || window.crypto.randomUUID()
    const syncPayload = { ...payload }
    delete syncPayload.clientId
    const operation = {
      clientOperationId,
      operationType: 'create',
      entityType: 'transaction',
      clientTimestamp: new Date().toISOString(),
      payload: syncPayload,
    }
    if (globalThis.navigator?.onLine === false) return queueOperation(operation)
    try {
      const response = await pushSyncOperations([operation])
      const result = response.results?.[0]
      if (result?.status === 'processed') {
        return { data: result.data, duplicate: Boolean(result.duplicate) }
      }
      const error = new Error(result?.conflict?.message ?? result?.error?.message ?? 'The server rejected this transaction.')
      error.response = {
        status: result?.status === 'conflict' ? 409 : result?.error?.code === 'SYNC_PROCESSING_FAILED' ? 503 : 400,
        data: { error: { code: result?.conflict?.code ?? result?.error?.code, message: error.message } },
      }
      throw error
    } catch (error) {
      if (!isQueueableNetworkError(error)) throw error
      return queueOperation(operation)
    }
  }

  async function updateOrQueue({ id, payload, transaction }) {
    if (globalThis.navigator?.onLine === false) {
      if (!transaction?.updatedAt) throw new Error('This transaction has no server version to update offline.')
      return queueOperation({
        clientOperationId: window.crypto.randomUUID(),
        operationType: 'update',
        entityType: 'transaction',
        entityId: String(id),
        baseUpdatedAt: new Date(transaction.updatedAt).toISOString(),
        clientTimestamp: new Date().toISOString(),
        payload,
      })
    }
    try {
      return await updateTransaction(id, payload)
    } catch (error) {
      if (!isQueueableNetworkError(error)) throw error
      if (!transaction?.updatedAt) throw error
      return queueOperation({
        clientOperationId: window.crypto.randomUUID(),
        operationType: 'update',
        entityType: 'transaction',
        entityId: String(id),
        baseUpdatedAt: new Date(transaction.updatedAt).toISOString(),
        clientTimestamp: new Date().toISOString(),
        payload,
      })
    }
  }

  async function removeOrQueue(value) {
    const transaction = typeof value === 'string' ? null : value
    const id = typeof value === 'string' ? value : value?.id ?? value?._id
    if (globalThis.navigator?.onLine === false) {
      if (!transaction?.updatedAt) throw new Error('This transaction has no server version to delete offline.')
      return queueOperation({
        clientOperationId: window.crypto.randomUUID(),
        operationType: 'delete',
        entityType: 'transaction',
        entityId: String(id),
        baseUpdatedAt: new Date(transaction.updatedAt).toISOString(),
        clientTimestamp: new Date().toISOString(),
        payload: {},
      })
    }
    try {
      return await deleteTransaction(id)
    } catch (error) {
      if (!isQueueableNetworkError(error) || !transaction?.updatedAt) throw error
      return queueOperation({
        clientOperationId: window.crypto.randomUUID(),
        operationType: 'delete',
        entityType: 'transaction',
        entityId: String(id),
        baseUpdatedAt: new Date(transaction.updatedAt).toISOString(),
        clientTimestamp: new Date().toISOString(),
        payload: {},
      })
    }
  }

  async function invalidateTransactionData(response) {
    if (response?.pendingSync && userId) {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['transactions'], refetchType: 'none' }),
        queryClient.invalidateQueries({ queryKey: ['wallets'], refetchType: 'none' }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'], refetchType: 'none' }),
        queryClient.invalidateQueries({ queryKey: ['budgets'], refetchType: 'none' }),
      ])
      queryClient.setQueryData(syncQueueKey(userId), await listOfflineOperations(userId))
      return
    }

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['transactions'] }),
      queryClient.invalidateQueries({ queryKey: ['wallets'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      queryClient.invalidateQueries({ queryKey: ['budgets'] }),
      queryClient.invalidateQueries({ queryKey: ['sync', 'queue'] }),
    ])
  }

  const options = {
    onSuccess: invalidateTransactionData,
    onError: (error) => toast.error(getErrorMessage(error, 'Could not save transaction.')),
  }

  return {
    create: useMutation({ mutationFn: createOrQueue, networkMode: 'always', ...options }),
    update: useMutation({
      mutationFn: updateOrQueue,
      networkMode: 'always',
      ...options,
    }),
    remove: useMutation({ mutationFn: removeOrQueue, networkMode: 'always', ...options }),
    restore: useMutation({ mutationFn: restoreTransaction, ...options }),
  }
}
