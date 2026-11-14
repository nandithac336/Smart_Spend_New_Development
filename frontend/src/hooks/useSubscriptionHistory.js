import { useQuery } from '@tanstack/react-query'
import { getSubscriptionHistory } from '@/services/subscriptionApi.js'

export function useSubscriptionHistory(id, enabled = true, page = 1) {
  return useQuery({
    queryKey: ['subscriptions', 'history', id, page],
    queryFn: () => getSubscriptionHistory(id, { page, limit: 20 }),
    enabled: Boolean(id) && enabled,
  })
}
