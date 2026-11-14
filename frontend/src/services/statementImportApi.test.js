import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from './api.js'
import {
  confirmStatementImport,
  listStatementDrafts,
  STATEMENT_UPLOAD_TIMEOUT_MS,
  uploadStatement,
  validateStatementFile,
} from './statementImportApi.js'

vi.mock('./api.js', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }))

describe('statement import API', () => {
  beforeEach(() => vi.clearAllMocks())

  it('validates extensions, empty files, and the ten megabyte limit', () => {
    expect(validateStatementFile(null)).toMatch(/Choose a bank statement/)
    expect(validateStatementFile({ name: 'file.txt', size: 2 })).toMatch(/CSV, XLSX, or text-based PDF/)
    expect(validateStatementFile({ name: 'file.csv', size: 0 })).toMatch(/empty/)
    expect(validateStatementFile({ name: 'file.pdf', size: 10 * 1024 * 1024 + 1 })).toMatch(/10 MB/)
    expect(validateStatementFile({ name: 'BANK.XLSX', size: 5 })).toBe('')
  })

  it('uploads multipart data to the existing endpoint and reports upload percentage', async () => {
    const file = new File(['csv'], 'bank.csv', { type: 'text/csv' })
    const progress = vi.fn()
    api.post.mockImplementation(async (_url, _body, config) => {
      config.onUploadProgress({ loaded: 1, total: 4 })
      return { data: { data: { _id: 'import-1', status: 'review' } } }
    })
    await expect(uploadStatement(file, { walletId: 'wallet-1', bankName: 'Bank', onUploadProgress: progress }))
      .resolves.toMatchObject({ status: 'review' })
    const [url, form] = api.post.mock.calls[0]
    expect(url).toBe('/imports/statements')
    expect(form.get('file')).toBe(file)
    expect(form.get('walletId')).toBe('wallet-1')
    expect(form.get('bankName')).toBe('Bank')
    expect(api.post.mock.calls[0][2].timeout).toBe(STATEMENT_UPLOAD_TIMEOUT_MS)
    expect(STATEMENT_UPLOAD_TIMEOUT_MS).toBeGreaterThan(10_000)
    expect(progress).toHaveBeenCalledWith(25)
  })

  it('fetches a retained failed import after a parsing error', async () => {
    const error = { response: { data: { error: { details: { importId: 'failed-1' } } } } }
    api.post.mockRejectedValue(error)
    api.get.mockResolvedValue({ data: { data: { _id: 'failed-1', status: 'failed' } } })
    await expect(uploadStatement(new File(['bad'], 'bad.csv'), { walletId: 'wallet-1' })).rejects.toBe(error)
    expect(error.importRecord).toMatchObject({ status: 'failed' })
  })

  it('requests paginated draft rows and confirms only explicitly selected ids', async () => {
    api.get.mockResolvedValue({ data: { data: [{ _id: 'draft-1' }], pagination: { page: 1, total: 1 } } })
    api.post.mockResolvedValue({ data: { data: [{ _id: 'txn-1' }], duplicate: false } })
    await expect(listStatementDrafts('import-1', { page: 1, limit: 100 })).resolves.toMatchObject({ drafts: [{ _id: 'draft-1' }] })
    await confirmStatementImport('import-1', { draftIds: ['draft-1'], allowDuplicateIds: [] })
    expect(api.get).toHaveBeenCalledWith('/imports/import-1/transactions', { params: { page: 1, limit: 100 } })
    expect(api.post).toHaveBeenCalledWith('/imports/import-1/confirm', { draftIds: ['draft-1'], allowDuplicateIds: [] })
  })
})
