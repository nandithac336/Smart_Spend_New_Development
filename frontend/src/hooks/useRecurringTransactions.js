import { useQuery } from '@tanstack/react-query'
import { listRecurringTransactions } from '@/services/recurringApi.js'

export function useRecurringTransactions() {
  return useQuery({
    queryKey: ['recurring'],
    queryFn: () => listRecurringTransactions(),
    refetchInterval: 60_000,
  })
}
