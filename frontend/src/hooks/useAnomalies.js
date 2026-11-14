import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { detectAnomalies, getAnomalySummary, listAnomalies, updateAnomalyStatus } from '@/services/anomalyApi.js'

export function useAnomalies(params, enabled = true) {
  return useQuery({
    queryKey: ['anomalies', params],
    queryFn: () => listAnomalies(params),
    enabled,
  })
}

export function useAnomalySummary() {
  return useQuery({
    queryKey: ['anomalies', 'summary'],
    queryFn: getAnomalySummary,
  })
}

export function useAnomalyMutations() {
  const client = useQueryClient()
  const refresh = () => Promise.all([
    client.invalidateQueries({ queryKey: ['anomalies'] }),
    client.invalidateQueries({ queryKey: ['transactions'] }),
  ])
  return {
    detect: useMutation({ mutationFn: detectAnomalies, onSuccess: refresh }),
    updateStatus: useMutation({ mutationFn: ({ id, status }) => updateAnomalyStatus(id, status), onSuccess: refresh }),
  }
}
