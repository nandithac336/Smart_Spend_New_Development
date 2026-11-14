import { useQuery } from '@tanstack/react-query'
import { getExpensePredictionData } from '@/services/predictionApi.js'

export function useExpensePredictions(month) {
  return useQuery({
    queryKey: ['expense-predictions', month || 'current'],
    queryFn: () => getExpensePredictionData(month),
    staleTime: 60_000,
  })
}
