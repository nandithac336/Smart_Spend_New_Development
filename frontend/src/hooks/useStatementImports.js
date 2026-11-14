import { useQuery } from '@tanstack/react-query'
import { getStatementImport, listStatementDrafts, listStatementImports } from '@/services/statementImportApi.js'

export function useStatementImports() {
  return useQuery({
    queryKey: ['statement-imports'],
    queryFn: () => listStatementImports({ page: 1, limit: 20 }),
  })
}

export function useStatementImport(id) {
  return useQuery({
    queryKey: ['statement-imports', id],
    queryFn: () => getStatementImport(id),
    enabled: Boolean(id),
  })
}

export function useStatementDrafts(id, page) {
  return useQuery({
    queryKey: ['statement-imports', id, 'drafts', page],
    queryFn: () => listStatementDrafts(id, { page, limit: 100 }),
    enabled: Boolean(id),
  })
}

export function useStatementDraftCount(id, reviewStatus) {
  return useQuery({
    queryKey: ['statement-imports', id, 'count', reviewStatus],
    queryFn: async () => (await listStatementDrafts(id, { page: 1, limit: 1, reviewStatus })).pagination.total,
    enabled: Boolean(id),
  })
}
