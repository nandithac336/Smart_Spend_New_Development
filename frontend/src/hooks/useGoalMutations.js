import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/errors.js'
import {
  addGoalContribution,
  archiveGoal,
  createGoal,
  pauseGoal,
  resumeGoal,
  updateGoal,
} from '@/services/goalApi.js'

export function useGoalMutations() {
  const queryClient = useQueryClient()
  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['goals'] })
  }
  const options = {
    onSuccess: invalidate,
    onError: (error) => toast.error(getErrorMessage(error, 'Could not update savings goals.')),
  }

  return {
    create: useMutation({ mutationFn: createGoal, ...options }),
    update: useMutation({
      mutationFn: ({ id, payload }) => updateGoal(id, payload),
      ...options,
    }),
    contribute: useMutation({
      mutationFn: ({ id, payload }) => addGoalContribution(id, payload),
      ...options,
    }),
    archive: useMutation({ mutationFn: archiveGoal, ...options }),
    pause: useMutation({ mutationFn: pauseGoal, ...options }),
    resume: useMutation({ mutationFn: resumeGoal, ...options }),
  }
}
