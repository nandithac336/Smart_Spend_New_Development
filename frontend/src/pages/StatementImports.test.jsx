import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import StatementImports from './StatementImports.jsx'

const mocks = vi.hoisted(() => ({ upload: vi.fn(), update: vi.fn(), confirm: vi.fn() }))
const record = {
  _id: 'import-1',
  status: 'review',
  bankName: 'Bank',
  file: { format: 'csv', originalName: 'bank.csv' },
  parsedTransactionCount: 1,
  importedCount: 0,
  duplicateCount: 0,
}
const draft = {
  _id: 'draft-1',
  rowNumber: 2,
  txnDate: '2026-11-05T00:00:00.000Z',
  description: 'Tea shop',
  amountPaise: 12550,
  direction: 'debit',
  duplicateStatus: 'none',
  duplicateMatches: [],
  validationErrors: [],
  reviewStatus: 'pending',
}

vi.mock('@/hooks/useAuth.js', () => ({ useAuth: () => ({ user: { timezone: 'Asia/Kolkata' } }) }))
vi.mock('@/hooks/useWallets.js', () => ({ useWallets: () => ({ data: { wallets: [{ id: 'wallet-1', name: 'Cash' }] }, isLoading: false, isError: false, refetch: vi.fn() }) }))
vi.mock('@/hooks/useCategories.js', () => ({ useCategories: () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }) }))
vi.mock('@/hooks/useStatementImports.js', () => ({
  useStatementImports: () => ({ data: { imports: [] }, isLoading: false, isError: false, refetch: vi.fn() }),
  useStatementImport: (id) => ({ data: id ? record : undefined, isLoading: false, isError: false, refetch: vi.fn() }),
  useStatementDrafts: (id) => ({ data: id ? { drafts: [draft], pagination: { page: 1, limit: 100, total: 1, pages: 1 } } : undefined, isLoading: false, isError: false, refetch: vi.fn() }),
  useStatementDraftCount: () => ({ data: 0, isLoading: false, isError: false, refetch: vi.fn() }),
}))
vi.mock('@/hooks/useStatementImportMutations.js', () => ({
  useStatementImportMutations: () => ({
    upload: { mutateAsync: mocks.upload, isPending: false },
    update: { mutateAsync: mocks.update, isPending: false },
    confirm: { mutateAsync: mocks.confirm, isPending: false },
  }),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

describe('StatementImports page', () => {
  afterEach(cleanup)
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.upload.mockResolvedValue(record)
    mocks.update.mockResolvedValue(draft)
    mocks.confirm.mockResolvedValue({ data: [{ _id: 'transaction-1' }], duplicate: false })
  })

  async function upload(user) {
    const file = new File(['csv'], 'bank.csv', { type: 'text/csv' })
    fireEvent.change(screen.getByLabelText('Statement file'), { target: { files: [file] } })
    await user.selectOptions(screen.getByLabelText('Import into wallet'), 'wallet-1')
    await user.click(screen.getByRole('button', { name: 'Upload for review' }))
    await screen.findByRole('heading', { name: 'Review extracted transactions' })
    expect(mocks.upload).toHaveBeenCalledWith(expect.objectContaining({ file, walletId: 'wallet-1' }))
  }

  it('creates no transaction before selection and explicit confirmation', async () => {
    const user = userEvent.setup()
    render(<StatementImports />)
    await upload(user)
    expect(mocks.confirm).not.toHaveBeenCalled()
    await user.click(screen.getByLabelText('Select for import'))
    await user.click(screen.getByRole('button', { name: 'Confirm import (1)' }))
    await waitFor(() => expect(mocks.confirm).toHaveBeenCalledWith({
      importId: 'import-1',
      payload: { draftIds: ['draft-1'], allowDuplicateIds: [] },
    }))
    expect(await screen.findByText('Successful: 1')).toBeInTheDocument()
    expect(screen.getByText('Failed: 0')).toBeInTheDocument()
  })

  it('reports selected-batch errors without claiming partial successes', async () => {
    mocks.confirm.mockRejectedValue({ response: { status: 409 }, message: 'Conflict' })
    const user = userEvent.setup()
    render(<StatementImports />)
    await upload(user)
    await user.click(screen.getByLabelText('Select for import'))
    await user.click(screen.getByRole('button', { name: 'Confirm import (1)' }))
    expect(await screen.findByText('Successful: 0')).toBeInTheDocument()
    expect(screen.getByText('Failed: 1')).toBeInTheDocument()
    expect(screen.getByText(/does not report per-row partial failures/)).toBeInTheDocument()
  })

  it('shows API parser errors after an upload fails without confirming transactions', async () => {
    mocks.upload.mockRejectedValue({
      response: { status: 422, data: { error: { message: 'No transaction rows were found.' } } },
    })
    const user = userEvent.setup()
    render(<StatementImports />)

    fireEvent.change(screen.getByLabelText('Statement file'), {
      target: { files: [new File(['bad csv'], 'bank.csv', { type: 'text/csv' })] },
    })
    await user.selectOptions(screen.getByLabelText('Import into wallet'), 'wallet-1')
    await user.click(screen.getByRole('button', { name: 'Upload for review' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('No transaction rows were found.')
    expect(mocks.confirm).not.toHaveBeenCalled()
  })

  it('explains statement upload timeouts with a retryable message', async () => {
    mocks.upload.mockRejectedValue({ code: 'ECONNABORTED' })
    const user = userEvent.setup()
    render(<StatementImports />)

    fireEvent.change(screen.getByLabelText('Statement file'), {
      target: { files: [new File(['date,amount'], 'bank.csv', { type: 'text/csv' })] },
    })
    await user.selectOptions(screen.getByLabelText('Import into wallet'), 'wallet-1')
    await user.click(screen.getByRole('button', { name: 'Upload for review' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/took too long.*try uploading again/)
  })
})
