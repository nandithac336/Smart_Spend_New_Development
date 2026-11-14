import { useQuery } from '@tanstack/react-query'
import { listWallets } from '@/services/walletApi.js'

export function useWallets() {
  return useQuery({
    queryKey: ['wallets'],
    queryFn: async () => {
      const response = await listWallets()
      return {
        wallets: response.data,
        totalBalance: response.totalBalance,
      }
    },
  })
}
