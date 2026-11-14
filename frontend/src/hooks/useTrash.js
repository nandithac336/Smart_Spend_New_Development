import { useQuery } from '@tanstack/react-query'
import { listTrash } from '@/services/transactionApi.js'

export function useTrash(enabled = true) {
  return useQuery({
    queryKey: ['transactions', 'trash'],
    enabled,
    queryFn: listTrash,
  })
}
