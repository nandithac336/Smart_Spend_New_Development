import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useStatementImportMutations } from './useStatementImportMutations.js'
import * as api from '@/services/statementImportApi.js'

vi.mock('@/services/statementImportApi.js', () => ({
  confirmStatementImport: vi.fn(),
  updateStatementDraft: vi.fn(),
  uploadStatement: vi.fn(),
}))

describe('statement import mutations', () => {
  afterEach(cleanup)
  it('refreshes import, transaction, wallet, dashboard and budget data after confirmation', async () => {
    const client = new QueryClient()
    const invalidate = vi.spyOn(client, 'invalidateQueries').mockResolvedValue()
    api.confirmStatementImport.mockResolvedValue({ data: [] })
    const wrapper = ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
    const { result } = renderHook(() => useStatementImportMutations(), { wrapper })
    await result.current.confirm.mutateAsync({ importId: 'i', payload: { draftIds: ['d'] } })
    const keys = invalidate.mock.calls.map(([options]) => options.queryKey)
    expect(keys).toEqual(expect.arrayContaining([
      ['statement-imports'], ['transactions'], ['wallets'], ['dashboard'], ['budgets'], ['analytics'],
    ]))
    client.clear()
  })
})
