import { useQuery } from '@tanstack/react-query'
import { getDashboard } from '@/services/dashboardApi.js'

export function useDashboard(date) {
  return useQuery({
    queryKey: ['dashboard', date],
    queryFn: () => getDashboard(date),
    placeholderData: (previousData) => previousData,
  })
}
