import { useMutation, useQueryClient } from '@tanstack/react-query'
import { acceptCategorySuggestion, rejectCategorySuggestion } from '@/services/categorizationApi.js'

export function useCategorizationMutations() {
  const queryClient = useQueryClient()
  const refresh = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['categorization'] }),
    queryClient.invalidateQueries({ queryKey: ['transactions'] }),
    queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    queryClient.invalidateQueries({ queryKey: ['analytics'] }),
    queryClient.invalidateQueries({ queryKey: ['budgets'] }),
  ])
  return {
    accept: useMutation({
      mutationFn: ({ id, categoryId }) => acceptCategorySuggestion(id, categoryId),
      onSuccess: refresh,
    }),
    reject: useMutation({
      mutationFn: rejectCategorySuggestion,
      onSuccess: refresh,
    }),
  }
}
