import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  archiveWallet,
  createWallet,
  transferBetweenWallets,
  updateWallet,
} from '@/services/walletApi.js'
import { getErrorMessage } from '@/lib/errors.js'

export function useWalletMutations() {
  const queryClient = useQueryClient()

  async function invalidateWalletData() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['wallets'] }),
      queryClient.invalidateQueries({ queryKey: ['transactions'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    ])
  }

  const options = (successMessage) => ({
    onSuccess: async () => {
      await invalidateWalletData()
      toast.success(successMessage)
    },
    onError: (error) => toast.error(getErrorMessage(error, 'Could not update wallets.')),
  })

  return {
    create: useMutation({ mutationFn: createWallet, ...options('Wallet added') }),
    update: useMutation({
      mutationFn: ({ id, payload }) => updateWallet(id, payload),
      ...options('Wallet updated'),
    }),
    archive: useMutation({ mutationFn: archiveWallet, ...options('Wallet archived') }),
    transfer: useMutation({ mutationFn: transferBetweenWallets, ...options('Transfer complete') }),
  }
}
