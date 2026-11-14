import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Cloud, CloudOff, RefreshCw, TriangleAlert } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth.js'
import { useOfflineSync } from '@/hooks/useOfflineSync.js'
import { registerServiceWorker } from '@/services/registerServiceWorker.js'

function OfflineStatus() {
  const { user } = useAuth()
  const userId = user?.id ?? user?._id
  const sync = useOfflineSync(userId)
  const [serviceWorkerError, setServiceWorkerError] = useState('')

  useEffect(() => {
    if (!import.meta.env.PROD) return
    registerServiceWorker().catch(() => {
      setServiceWorkerError('Offline app-shell caching is unavailable; queued changes still remain saved on this device.')
    })
  }, [])

  const runtimeState = sync.runtime?.state
  const backendUnavailable = ['failed', 'unavailable'].includes(runtimeState)
  const authRequired = runtimeState === 'auth_required'
  const needsAttention = runtimeState === 'attention' ||
    sync.operations.some((operation) => ['conflict', 'attention', 'auth_required'].includes(operation.status))
  const syncing = sync.isSyncing
  const offline = !sync.online || backendUnavailable
  const label = syncing
    ? 'Synchronizing'
    : authRequired
      ? 'Sign in to synchronize'
      : needsAttention
        ? 'Sync needs attention'
        : !sync.online
          ? 'Offline'
          : backendUnavailable
            ? 'Server unavailable'
            : sync.operations.length
              ? `${sync.operations.length} pending`
              : 'Online'
  const Icon = syncing
    ? RefreshCw
    : needsAttention || authRequired
      ? TriangleAlert
      : offline
        ? CloudOff
        : Cloud

  return (
    <div className="mb-4 space-y-2">
      <Link
        aria-label={`Synchronization status: ${label}`}
        className={`inline-flex min-h-9 items-center gap-2 rounded-full border px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          offline || needsAttention || authRequired
            ? 'border-warning/30 bg-warning/10 text-warning'
            : syncing
              ? 'border-primary/30 bg-primary/10 text-primary'
              : 'border-border/70 bg-card/60 text-muted-foreground hover:text-foreground'
        }`}
        to="/sync"
      >
        <Icon aria-hidden="true" className={`size-4 ${syncing ? 'animate-spin' : ''}`} />
        <span aria-live="polite">{label}</span>
      </Link>
      {serviceWorkerError && (
        <p className="text-xs text-warning" role="status">{serviceWorkerError}</p>
      )}
      {sync.queue.isError && (
        <p className="text-xs text-destructive" role="alert">Offline queue is unavailable. Do not retry this transaction until storage is available.</p>
      )}
    </div>
  )
}

export default OfflineStatus
