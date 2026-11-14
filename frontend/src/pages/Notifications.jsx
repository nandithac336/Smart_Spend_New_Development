import { useMemo, useState } from 'react'
import { Bell, ChevronLeft, ChevronRight, RefreshCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import EmptyState from '@/components/common/EmptyState.jsx'
import ErrorState from '@/components/common/ErrorState.jsx'
import PageHeader from '@/components/common/PageHeader.jsx'
import NotificationCard from '@/components/notifications/NotificationCard.jsx'
import NotificationFilters from '@/components/notifications/NotificationFilters.jsx'
import NotificationLoading from '@/components/notifications/NotificationLoading.jsx'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog.jsx'
import { Button } from '@/components/ui/button.jsx'
import { useAuth } from '@/hooks/useAuth.js'
import { useNotificationMutations, useNotifications, useUnreadNotificationCount } from '@/hooks/useNotifications.js'

const PAGE_SIZE = 20

function Notifications() {
  const { user } = useAuth()
  const timeZone = user?.timezone || 'Asia/Kolkata'
  const [status, setStatus] = useState('all')
  const [type, setType] = useState('all')
  const [severity, setSeverity] = useState('all')
  const [page, setPage] = useState(1)
  const params = useMemo(() => ({
    ...(status !== 'all' ? { isRead: status === 'read' } : {}),
    ...(type !== 'all' ? { type } : {}),
    ...(severity !== 'all' ? { severity } : {}),
    page,
    limit: PAGE_SIZE,
  }), [page, severity, status, type])
  const list = useNotifications(params)
  const unread = useUnreadNotificationCount()
  const mutations = useNotificationMutations()
  const items = Array.isArray(list.data?.data) ? list.data.data : []
  const pagination = list.data?.pagination
  const pages = Math.max(1, pagination?.pages ?? 1)
  const busy = mutations.markRead.isPending || mutations.markAllRead.isPending ||
    mutations.remove.isPending || mutations.removeAll.isPending

  function changeFilter(setter, value) {
    setter(value)
    setPage(1)
  }

  async function refresh() {
    const results = await Promise.all([list.refetch(), unread.refetch()])
    if (results.some((result) => result.isError)) {
      toast.error('Could not refresh notifications.')
      return
    }
    toast.success('Notifications refreshed')
  }

  async function markRead(id) {
    try {
      await mutations.markRead.mutateAsync(id)
      toast.success('Notification marked as read')
    } catch {
      // Mutation errors are reported by the mutation hook.
    }
  }

  async function markAllRead() {
    try {
      const result = await mutations.markAllRead.mutateAsync()
      toast.success(`${result?.modifiedCount ?? 0} notification${result?.modifiedCount === 1 ? '' : 's'} marked as read`)
    } catch {
      // Mutation errors are reported by the mutation hook.
    }
  }

  async function removeNotification(id) {
    try {
      await mutations.remove.mutateAsync(id)
      if (items.length === 1 && page > 1) setPage((current) => current - 1)
      toast.success('Notification deleted')
    } catch {
      // Mutation errors are reported by the mutation hook.
    }
  }

  async function removeAllNotifications() {
    try {
      const result = await mutations.removeAll.mutateAsync()
      setPage(1)
      toast.success(`${result?.deletedCount ?? 0} notification${result?.deletedCount === 1 ? '' : 's'} deleted`)
    } catch {
      // Mutation errors are reported by the mutation hook.
    }
  }

  const hasFilters = status !== 'all' || type !== 'all' || severity !== 'all'
  const actions = (
    <div className="flex flex-wrap gap-2">
      {unread.data > 0 && (
        <Button disabled={busy} onClick={markAllRead} variant="outline">
          <Bell aria-hidden="true" />
          Mark all read
        </Button>
      )}
      {pagination?.total > 0 && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button disabled={busy} variant="outline">
              <Trash2 aria-hidden="true" />
              Clear all
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete all notifications?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently deletes all your notifications, including items outside the current filters and pages.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={removeAllNotifications} variant="destructive">Delete all</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
      <Button disabled={list.isFetching || unread.isFetching} onClick={refresh} variant="outline">
        <RefreshCw aria-hidden="true" className={list.isFetching || unread.isFetching ? 'animate-spin' : ''} />
        Refresh
      </Button>
    </div>
  )

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        action={actions}
        description="Review financial alerts and reminders generated from your SmartSpend activity."
        eyebrow="Stay up to date"
        title="Notifications"
      />

      <section aria-label="Notification delivery information" className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
        Notifications are generated by the backend’s scheduled checks. Live push delivery and notification preferences are not available.
      </section>

      {unread.isError && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3" role="alert">
          <p className="text-sm text-destructive">Unread notification count is unavailable.</p>
          <Button onClick={() => unread.refetch()} size="sm" variant="outline">Retry count</Button>
        </div>
      )}

      <NotificationFilters
        onSeverityChange={(value) => changeFilter(setSeverity, value)}
        onStatusChange={(value) => changeFilter(setStatus, value)}
        onTypeChange={(value) => changeFilter(setType, value)}
        severity={severity}
        status={status}
        type={type}
      />

      {list.isPending ? (
        <NotificationLoading />
      ) : list.isError ? (
        <ErrorState
          description="Notifications could not be loaded. Check your connection and try again."
          onRetry={() => list.refetch()}
          title="Couldn’t load notifications"
        />
      ) : items.length === 0 ? (
        <EmptyState
          action={hasFilters ? (
            <Button onClick={() => {
              setStatus('all')
              setType('all')
              setSeverity('all')
              setPage(1)
            }} variant="outline">
              Clear filters
            </Button>
          ) : undefined}
          description={hasFilters
            ? 'No notifications match these filters. Try changing or clearing the filters.'
            : 'There are no notifications to show right now. New alerts will appear here when the backend detects supported activity.'}
          icon={Bell}
          title={hasFilters ? 'No matching notifications' : 'You’re all caught up'}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p aria-live="polite" className="text-xs text-muted-foreground">
              {pagination?.total ?? items.length} notification{pagination?.total === 1 ? '' : 's'}
              {unread.data !== undefined && ` · ${unread.data} unread`}
            </p>
            <p className="text-xs text-muted-foreground">Updates are checked periodically, not delivered live.</p>
          </div>
          <div className="space-y-3">
            {items.map((notification, index) => (
              <NotificationCard
                busy={busy}
                key={notification._id ?? notification.id ?? `${notification.type}-${notification.createdAt}-${index}`}
                notification={notification}
                onDelete={removeNotification}
                onMarkRead={markRead}
                timeZone={timeZone}
              />
            ))}
          </div>
          {pagination?.pages > 1 && (
            <nav aria-label="Notification pages" className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">Page {pagination.page} of {pagination.pages}</p>
              <div className="flex gap-2">
                <Button disabled={page <= 1 || list.isFetching} onClick={() => setPage((current) => current - 1)} variant="outline">
                  <ChevronLeft aria-hidden="true" />
                  Previous
                </Button>
                <Button disabled={page >= pages || list.isFetching} onClick={() => setPage((current) => current + 1)} variant="outline">
                  Next
                  <ChevronRight aria-hidden="true" />
                </Button>
              </div>
            </nav>
          )}
        </>
      )}
    </div>
  )
}

export default Notifications
