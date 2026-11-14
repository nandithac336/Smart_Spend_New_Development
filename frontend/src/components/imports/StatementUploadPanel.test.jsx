import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import StatementUploadPanel from './StatementUploadPanel.jsx'

describe('StatementUploadPanel', () => {
  afterEach(cleanup)

  it('submits a supported file with selected wallet and bank label', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    const file = new File(['csv'], 'bank.csv', { type: 'text/csv' })
    render(<StatementUploadPanel wallets={[{ id: 'wallet-1', name: 'Main bank' }]} walletsLoading={false} walletsError={false} retryWallets={vi.fn()} onSubmit={onSubmit} busy={false} progress={0} error="" />)
    fireEvent.change(screen.getByLabelText('Statement file'), { target: { files: [file] } })
    await user.selectOptions(screen.getByLabelText('Import into wallet'), 'wallet-1')
    await user.type(screen.getByLabelText('Bank name (optional)'), 'Bank')
    await user.click(screen.getByRole('button', { name: 'Upload for review' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ file, walletId: 'wallet-1', bankName: 'Bank' }))
  })

  it('rejects unsupported extensions and indicates parsing progress', () => {
    const file = new File(['x'], 'statement.docx')
    const props = { wallets: [{ id: 'wallet', name: 'Wallet' }], walletsLoading: false, walletsError: false, retryWallets: vi.fn(), onSubmit: vi.fn(), busy: false, progress: 0, error: '' }
    const { rerender } = render(<StatementUploadPanel {...props} />)
    fireEvent.change(screen.getByLabelText('Statement file'), { target: { files: [file] } })
    expect(screen.getByText(/Choose a CSV, XLSX, or text-based PDF/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Upload for review' })).toBeDisabled()
    rerender(<StatementUploadPanel {...props} busy progress={100} />)
    expect(screen.getByText(/Statement received; parsing rows/)).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
  })
})
