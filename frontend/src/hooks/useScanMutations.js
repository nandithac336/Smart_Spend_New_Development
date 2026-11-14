import { useMutation, useQueryClient } from '@tanstack/react-query'
import { confirmScan, deleteScan, updateScanDraft, uploadScan } from '@/services/scanApi.js'

export function useScanMutations() {
  const queryClient = useQueryClient()
  const refreshScans = () => queryClient.invalidateQueries({ queryKey: ['scans'] })
  const refreshTransactions = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['transactions'] }),
    queryClient.invalidateQueries({ queryKey: ['wallets'] }),
    queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    queryClient.invalidateQueries({ queryKey: ['budgets'] }),
    queryClient.invalidateQueries({ queryKey: ['analytics'] }),
  ])

  return {
    upload: useMutation({ mutationFn: ({ type, file }) => uploadScan(type, file), onSuccess: refreshScans }),
    update: useMutation({ mutationFn: ({ id, changes }) => updateScanDraft(id, changes), onSuccess: refreshScans }),
    confirm: useMutation({
      mutationFn: ({ id, payload }) => confirmScan(id, payload),
      onSuccess: async () => {
        await Promise.all([refreshScans(), refreshTransactions()])
      },
    }),
    remove: useMutation({ mutationFn: deleteScan, onSuccess: refreshScans }),
  }
}
