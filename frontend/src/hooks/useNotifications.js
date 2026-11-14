import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/errors.js'
import {
  deleteAllNotifications,
  deleteNotification,
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/services/notificationApi.js'

export function useNotifications(params) {
  return useQuery({
    queryKey: ['notifications', 'list', params],
    queryFn: () => listNotifications(params),
  })
}

export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: getUnreadNotificationCount,
    refetchInterval: 60_000,
  })
}

export function useNotificationMutations() {
  const queryClient = useQueryClient()
  const invalidateNotifications = () => queryClient.invalidateQueries({ queryKey: ['notifications'] })
  const options = {
    onSuccess: invalidateNotifications,
    onError: (error) => toast.error(getErrorMessage(error, 'Could not update notifications.')),
  }

  return {
    markRead: useMutation({ mutationFn: markNotificationRead, ...options }),
    markAllRead: useMutation({ mutationFn: markAllNotificationsRead, ...options }),
    remove: useMutation({ mutationFn: deleteNotification, ...options }),
    removeAll: useMutation({ mutationFn: deleteAllNotifications, ...options }),
  }
}
