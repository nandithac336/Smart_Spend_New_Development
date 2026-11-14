import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  discardQueuedOperation,
  getLastSuccessfulSyncAt,
  listOfflineOperations,
  syncQueueKey,
  syncRuntimeKey,
  syncServerStatusKey,
  synchronizeUserQueue,
} from '@/services/offlineSync.js'
import { useNetworkStatus } from './useNetworkStatus.js'

export function useOfflineSync(userId) {
  const queryClient = useQueryClient()
  const online = useNetworkStatus()
  const queue = useQuery({
    queryKey: syncQueueKey(userId),
    queryFn: () => listOfflineOperations(userId),
    enabled: Boolean(userId),
  })
  const lastSuccessfulSync = useQuery({
    queryKey: ['sync', 'last-success', userId],
    queryFn: () => getLastSuccessfulSyncAt(userId),
    enabled: Boolean(userId),
  })
  const runtime = useQuery({
    queryKey: syncRuntimeKey(userId),
    queryFn: async () => ({ state: 'idle' }),
    enabled: Boolean(userId),
    initialData: { state: 'idle' },
    staleTime: Infinity,
  })
  const serverStatusQuery = useQuery({
    queryKey: syncServerStatusKey(userId),
    queryFn: async () => null,
    enabled: false,
  })
  const syncMutation = useMutation({
    mutationFn: ({ force = false } = {}) => synchronizeUserQueue(userId, queryClient, { force }),
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: syncQueueKey(userId) }),
        queryClient.invalidateQueries({ queryKey: ['sync', 'last-success', userId] }),
      ])
    },
  })
  const discardMutation = useMutation({
    mutationFn: (operationId) => discardQueuedOperation(userId, operationId, queryClient),
  })

  return {
    online,
    queue,
    operations: queue.data ?? [],
    lastSuccessfulSync: lastSuccessfulSync.data,
    runtime: runtime.data,
    serverStatus: serverStatusQuery.data,
    sync: (options) => syncMutation.mutateAsync(options),
    isSyncing: syncMutation.isPending || runtime.data?.state === 'syncing' || runtime.data?.state === 'checking',
    syncError: syncMutation.error,
    discard: (operationId) => discardMutation.mutateAsync(operationId),
    isDiscarding: discardMutation.isPending,
  }
}

export function useOfflineSyncManager(userId) {
  const queryClient = useQueryClient()
  const queue = useQuery({
    queryKey: syncQueueKey(userId),
    queryFn: () => listOfflineOperations(userId),
    enabled: Boolean(userId),
  })

  useEffect(() => {
    if (!userId) return undefined
    const synchronize = () => {
      if (globalThis.navigator?.onLine === false) return
      synchronizeUserQueue(userId, queryClient)
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') synchronize()
    }
    synchronize()
    window.addEventListener('online', synchronize)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.removeEventListener('online', synchronize)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [queryClient, userId])

  useEffect(() => {
    if (!userId || globalThis.navigator?.onLine === false) return undefined
    const retryAt = queue.data
      ?.filter((operation) => operation.status === 'pending' && operation.nextRetryAt > Date.now())
      .reduce((earliest, operation) => Math.min(earliest, operation.nextRetryAt), Infinity)
    if (!Number.isFinite(retryAt)) return undefined
    const timer = window.setTimeout(
      () => synchronizeUserQueue(userId, queryClient),
      Math.max(0, retryAt - Date.now()),
    )
    return () => window.clearTimeout(timer)
  }, [queryClient, queue.data, userId])

  useEffect(() => {
    if (!userId || globalThis.navigator?.onLine === false) return
    const hasDueOperation = queue.data?.some((operation) =>
      operation.status === 'pending' && operation.nextRetryAt <= Date.now()
    )
    if (hasDueOperation) synchronizeUserQueue(userId, queryClient)
  }, [queryClient, queue.data, userId])
}
