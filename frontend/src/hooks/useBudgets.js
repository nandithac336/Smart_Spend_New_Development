import { useQuery } from '@tanstack/react-query'
import { getBudgetsSummary } from '@/services/budgetApi.js'

export function useBudgets() {
  return useQuery({
    queryKey: ['budgets', 'summary'],
    queryFn: getBudgetsSummary,
  })
}
