import { useQuery } from '@tanstack/react-query'
import { getGoalsSummary } from '@/services/goalApi.js'

export function useGoals() {
  return useQuery({
    queryKey: ['goals', 'summary'],
    queryFn: getGoalsSummary,
  })
}
