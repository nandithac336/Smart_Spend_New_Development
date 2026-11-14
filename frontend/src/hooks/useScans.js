import { useQuery } from '@tanstack/react-query'
import { listScans } from '@/services/scanApi.js'

export function useScans(type) {
  return useQuery({
    queryKey: ['scans', type],
    queryFn: () => listScans({ type, limit: 20 }),
    staleTime: 30_000,
  })
}
