import { useQuery } from '@tanstack/react-query'
import { getFinancialHealth } from '@/services/financialHealthApi.js'

export function useFinancialHealth() {
  return useQuery({
    queryKey: ['financial-health'],
    queryFn: getFinancialHealth,
    staleTime: 60_000,
  })
}
