import { useState } from 'react'
import { Cloud, CloudOff, RefreshCw, ShieldCheck, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth.js'
import { useOfflineSync } from '@/hooks/useOfflineSync.js'
import { formatTxnDate } from '@/lib/dates.js'
import PageHeader from '@/components/common/PageHeader.jsx'
import EmptyState from '@/components/common/EmptyState.jsx'
import ErrorState from '@/components/common/ErrorState.jsx'
import SyncOperationCard from '@/components/offline/SyncOperationCard.jsx'
import { Button } from '@/components/ui/button.jsx'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog.jsx'

function Sync() {
  const { user } = useAuth()
  const sync = useOfflineSync(user?.id ?? user?._id)
  const [discardTarget, setDiscardTarget] = useState(null)
  const timeZone = user?.timezone || 'Asia/Kolkata'
  const pendingCount = sync.operations.filter((item) => item.status === 'pending' || item.status === 'syncing').length
  const attentionCount = sync.operations.filter((item) => ['conflict', 'attention', 'auth_required'].includes(item.status)).length
  const lastSyncAt = sync.lastSuccessfulSync ?? sync.runtime?.lastSuccessfulSyncAt

  async function synchronize() {
    try {
      const result = await sync.sync({ force: true })
      if (result.state === 'synced') toast.success('Synchronization completed')
      else if (result.state === 'pending') toast('Some changes remain queued for retry')
      else if (result.state === 'attention') toast('Synchronization completed with items needing attention')
      else toast.error(result.error?.message ?? 'Synchronization could not be completed.')
    } catch (error) {
      toast.error(error.message || 'Synchronization could not be completed.')
    }
  }

  async function discard() {
    if (!discardTarget) return
    try {
      await sync.discard(discardTarget.operation.clientOperationId)
      toast.success('Queued change discarded')
      setDiscardTarget(null)
    } catch (error) {
      toast.error(error.message || 'Could not discard the queued change.')
    }
  }

  const runtimeState = sync.runtime?.state
  const statusLabel = !sync.online
    ? 'Browser is offline'
    : ['unavailable', 'failed'].includes(runtimeState)
      ? 'SmartSpend server is unavailable'
      : runtimeState === 'auth_required'
        ? 'Sign in again to synchronize'
        : runtimeState === 'syncing' || runtimeState === 'checking'
          ? 'Synchronization is in progress'
          : attentionCount > 0
            ? 'Some changes need your attention'
            : 'Connected'
  const StatusIcon = !sync.online || ['unavailable', 'failed'].includes(runtimeState)
    ? CloudOff
    : attentionCount > 0 || runtimeState === 'auth_required'
      ? TriangleAlert
      : runtimeState === 'syncing' || runtimeState === 'checking'
        ? RefreshCw
        : Cloud

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        description="Review pending transaction changes and synchronize them with your account."
        eyebrow="Offline mode"
        title="Sync Centre"
      />

      <section aria-label="Synchronization status" className="glass-flat rounded-2xl border border-border/70 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <StatusIcon aria-hidden="true" className={`size-5 ${runtimeState === 'syncing' || runtimeState === 'checking' ? 'animate-spin' : ''}`} />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold">{statusLabel}</h2>
              <p aria-live="polite" className="mt-1 text-xs text-muted-foreground">
                {pendingCount} pending · {attentionCount} needing attention
                {sync.runtime?.processed ? ` · ${sync.runtime.processed} synchronized this run` : ''}
              </p>
            </div>
          </div>
          <Button disabled={!sync.online || sync.isSyncing} onClick={synchronize}>
            <RefreshCw aria-hidden="true" className={sync.isSyncing ? 'animate-spin' : ''} />
            {sync.isSyncing ? 'Synchronizing…' : 'Sync now'}
          </Button>
        </div>
        <dl className="mt-4 grid gap-3 border-t border-border/60 pt-4 text-xs sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">Last successful sync</dt>
            <dd className="mt-1 font-medium">{lastSyncAt ? formatTxnDate(lastSyncAt, { timeZone }) : 'Not yet synchronized'}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Latest server transaction change</dt>
            <dd className="mt-1 font-medium">{sync.serverStatus?.latestChangeAt
              ? formatTxnDate(sync.serverStatus.latestChangeAt, { timeZone })
              : 'Unavailable'}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Server-reported conflicts</dt>
            <dd className="mt-1 font-medium">{sync.serverStatus?.conflictedOperations ?? 'Unavailable'}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-2xl border border-accent-blue/20 bg-accent-blue/5 p-4 text-sm text-muted-foreground">
        Only transaction creates, edits and deletes are queued for offline synchronization. Other SmartSpend pages still need a server connection. Queued transactions are not included in confirmed balances or reports until the server accepts them. This device stores queued transaction details and limited wallet/category references in IndexedDB; the service worker does not cache API traffic, credentials or transaction history.
      </section>

      {sync.runtime?.state === 'auth_required' && (
        <div className="flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm text-warning" role="alert">
          <TriangleAlert aria-hidden="true" className="size-4 shrink-0" />
          Your queued changes are preserved. Sign in again with this account to resume synchronization.
        </div>
      )}
      {sync.runtime?.state === 'synced' && pendingCount === 0 && attentionCount === 0 && (
        <p className="sr-only" role="status"><ShieldCheck aria-hidden="true" /> All queued changes are synchronized.</p>
      )}
      {sync.queue.isError ? (
        <ErrorState
          description="The local synchronization queue could not be opened. Reconnect before making changes and retry."
          onRetry={() => sync.queue.refetch()}
          title="Couldn’t load the sync queue"
        />
      ) : sync.queue.isPending ? (
        <div aria-busy="true" aria-label="Loading synchronization queue" className="space-y-3">
          {Array.from({ length: 3 }, (_, index) => <div className="glass-flat h-24 animate-pulse rounded-2xl" key={index} />)}
        </div>
      ) : sync.operations.length === 0 ? (
        <EmptyState
          description={sync.online
            ? 'There are no locally queued changes. Changes made on other devices are refreshed through the regular SmartSpend APIs.'
            : 'There are no locally queued changes yet. New transaction changes will be saved here until you reconnect.'}
          icon={Cloud}
          title="Your sync queue is clear"
        />
      ) : (
        <section aria-label="Queued synchronization operations" className="space-y-3">
          <h2 className="text-sm font-semibold">Queued changes ({sync.operations.length})</h2>
          <ul className="space-y-3">
            {sync.operations.map((item) => (
              <SyncOperationCard
                busy={sync.isDiscarding}
                item={item}
                key={item.id}
                onDiscard={setDiscardTarget}
                timeZone={timeZone}
              />
            ))}
          </ul>
        </section>
      )}

      <AlertDialog open={Boolean(discardTarget)} onOpenChange={(open) => { if (!open) setDiscardTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard this queued change?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes only the local operation from this device. It cannot undo a server-confirmed transaction. Review the transaction before continuing.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep queued</AlertDialogCancel>
            <AlertDialogAction onClick={discard} variant="destructive">Discard change</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default Sync
