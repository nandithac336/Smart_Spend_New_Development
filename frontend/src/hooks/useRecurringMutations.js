import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/errors.js'
import {
  cancelRecurringTransaction,
  createRecurringTransaction,
  pauseRecurringTransaction,
  resumeRecurringTransaction,
  updateRecurringTransaction,
} from '@/services/recurringApi.js'

export function useRecurringMutations() {
  const queryClient = useQueryClient()
  const options = {
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['recurring'] })
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Could not update recurring transactions.')),
  }

  return {
    create: useMutation({ mutationFn: createRecurringTransaction, ...options }),
    update: useMutation({
      mutationFn: ({ id, payload }) => updateRecurringTransaction(id, payload),
      ...options,
    }),
    pause: useMutation({ mutationFn: pauseRecurringTransaction, ...options }),
    resume: useMutation({ mutationFn: resumeRecurringTransaction, ...options }),
    cancel: useMutation({ mutationFn: cancelRecurringTransaction, ...options }),
  }
}
