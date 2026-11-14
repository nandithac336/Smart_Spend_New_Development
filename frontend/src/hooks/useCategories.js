import { useQuery } from '@tanstack/react-query'
import { listCategories } from '@/services/categoryApi.js'

export function useCategories(type) {
  return useQuery({
    queryKey: ['categories', type ?? 'all'],
    queryFn: () => listCategories(type ? { type } : undefined),
  })
}
