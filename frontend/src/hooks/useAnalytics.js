import { useQuery } from '@tanstack/react-query'
import { getAnalyticsDashboard } from '@/services/analyticsApi.js'
import { getAnalyticsDayCount } from '@/lib/analyticsFilters.js'

export function useAnalytics(params, enabled = true) {
  const includeDaily = params.period !== 'custom' ||
    getAnalyticsDayCount(params.startDate, params.endDate) <= 366

  return useQuery({
    queryKey: ['analytics', params],
    queryFn: () => getAnalyticsDashboard(params, includeDaily),
    enabled,
    staleTime: 60_000,
  })
}
