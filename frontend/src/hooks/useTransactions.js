import { useInfiniteQuery } from '@tanstack/react-query'
import { listTransactions } from '@/services/transactionApi.js'

const PAGE_SIZE = 20

export function useTransactions(filters = {}, enabled = true) {
  return useInfiniteQuery({
    queryKey: ['transactions', filters],
    enabled,
    initialPageParam: 1,
    queryFn: ({ pageParam }) => listTransactions({
      ...filters,
      page: pageParam,
      limit: filters.limit ?? PAGE_SIZE,
    }),
    getNextPageParam: (lastPage) => {
      const { page, pages } = lastPage.pagination
      return page < pages ? page + 1 : undefined
    },
  })
}
