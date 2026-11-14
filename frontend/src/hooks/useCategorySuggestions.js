import { useQuery } from '@tanstack/react-query'
import { listCategorySuggestions } from '@/services/categorizationApi.js'

export function useCategorySuggestions(page = 1, status = 'pending') {
  return useQuery({
    queryKey: ['categorization', 'suggestions', status, page],
    queryFn: () => listCategorySuggestions({ page, limit: 20, status }),
  })
}
