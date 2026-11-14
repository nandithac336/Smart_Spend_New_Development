import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/errors.js'
import {
  cancelSubscription,
  confirmSubscription,
  detectSubscriptions,
  dismissSubscription,
  getSubscriptionSummary,
  listSubscriptions,
  updateSubscription,
} from '@/services/subscriptionApi.js'

export function useSubscriptions(params) {
  return useQuery({
    queryKey: ['subscriptions', 'list', params],
    queryFn: () => listSubscriptions(params),
  })
}

export function useSubscriptionSummary() {
  return useQuery({
    queryKey: ['subscriptions', 'summary'],
    queryFn: getSubscriptionSummary,
  })
}

export function useSubscriptionMutations() {
  const queryClient = useQueryClient()
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['subscriptions'] })
  }
  const options = {
    onSuccess: refresh,
    onError: (error) => toast.error(getErrorMessage(error, 'Could not update subscriptions.')),
  }

  return {
    detect: useMutation({ mutationFn: detectSubscriptions, ...options }),
    update: useMutation({
      mutationFn: ({ id, payload }) => updateSubscription(id, payload),
      ...options,
    }),
    confirm: useMutation({ mutationFn: confirmSubscription, ...options }),
    dismiss: useMutation({ mutationFn: dismissSubscription, ...options }),
    cancel: useMutation({ mutationFn: cancelSubscription, ...options }),
  }
}
