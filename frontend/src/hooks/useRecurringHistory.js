import { useQuery } from '@tanstack/react-query'
import { getRecurringHistory } from '@/services/recurringApi.js'

export function useRecurringHistory(id, enabled = true) {
  return useQuery({
    queryKey: ['recurring', 'history', id],
    queryFn: () => getRecurringHistory(id),
    enabled: Boolean(id) && enabled,
  })
}
