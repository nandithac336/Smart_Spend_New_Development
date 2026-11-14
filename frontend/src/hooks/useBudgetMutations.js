import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/errors.js'
import { archiveBudget, createBudget, updateBudget } from '@/services/budgetApi.js'

export function useBudgetMutations() {
  const queryClient = useQueryClient()
  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['budgets'] })
  }
  const options = {
    onSuccess: invalidate,
    onError: (error) => toast.error(getErrorMessage(error, 'Could not update budgets.')),
  }

  return {
    create: useMutation({ mutationFn: createBudget, ...options }),
    update: useMutation({
      mutationFn: ({ id, payload }) => updateBudget(id, payload),
      ...options,
    }),
    archive: useMutation({ mutationFn: archiveBudget, ...options }),
  }
}
