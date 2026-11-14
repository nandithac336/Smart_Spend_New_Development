import { useMutation, useQueryClient } from '@tanstack/react-query'
import { confirmStatementImport, updateStatementDraft, uploadStatement } from '@/services/statementImportApi.js'

export function useStatementImportMutations() {
  const client = useQueryClient()
  const invalidate = (queryKey) => client.invalidateQueries({ queryKey })
  const refreshImport = () => invalidate(['statement-imports'])
  const refreshFinancialData = () => Promise.all(
    ['transactions', 'wallets', 'dashboard', 'budgets', 'analytics'].map((key) => invalidate([key])),
  )

  return {
    upload: useMutation({
      mutationFn: ({ file, ...options }) => uploadStatement(file, options),
      onSettled: refreshImport,
    }),
    update: useMutation({
      mutationFn: ({ importId, draftId, changes }) => updateStatementDraft(importId, draftId, changes),
      onSuccess: refreshImport,
    }),
    confirm: useMutation({
      mutationFn: ({ importId, payload }) => confirmStatementImport(importId, payload),
      onSettled: async () => Promise.all([refreshImport(), refreshFinancialData()]),
    }),
  }
}
