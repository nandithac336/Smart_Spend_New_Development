import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  deleteAskSpartConversation,
  getAskSpartConversation,
  getAskSpartHealth,
  listAskSpartConversations,
  sendAskSpartMessage,
} from '@/services/askSpartApi.js'

export function useAskSpartConversations(page = 1) {
  return useInfiniteQuery({
    queryKey: ['ask-spart', 'conversations'],
    queryFn: ({ pageParam }) => listAskSpartConversations({ page: pageParam, limit: 50, status: 'active' }),
    initialPageParam: page,
    getNextPageParam: (lastPage) => lastPage.pagination.page < lastPage.pagination.pages
      ? lastPage.pagination.page + 1
      : undefined,
  })
}

export function useAskSpartConversation(id) {
  return useQuery({
    queryKey: ['ask-spart', 'conversation', id],
    queryFn: () => getAskSpartConversation(id),
    enabled: Boolean(id),
  })
}

export function useAskSpartHealth() {
  return useQuery({
    queryKey: ['ask-spart', 'health'],
    queryFn: getAskSpartHealth,
    staleTime: 60_000,
  })
}

export function useAskSpartMutations() {
  const queryClient = useQueryClient()
  return {
    send: useMutation({
      mutationFn: sendAskSpartMessage,
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ask-spart', 'conversations'] }),
    }),
    remove: useMutation({
      mutationFn: deleteAskSpartConversation,
      onSuccess: (_data, id) => Promise.all([
        queryClient.invalidateQueries({ queryKey: ['ask-spart', 'conversations'] }),
        queryClient.removeQueries({ queryKey: ['ask-spart', 'conversation', id] }),
      ]),
    }),
  }
}
