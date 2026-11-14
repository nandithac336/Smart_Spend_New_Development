import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import TransferForm from './TransferForm.jsx'

describe('TransferForm', () => {
  afterEach(cleanup)

  it('converts the transfer amount to paise and keeps the two wallet ids distinct', async () => {
    const user = userEvent.setup()
    const transfer = vi.fn().mockResolvedValue({})
    const wallets = [
      { id: 'cash-id', name: 'Cash' },
      { _id: 'upi-id', name: 'UPI' },
    ]

    render(
      <TransferForm
        mutations={{ transfer: { isPending: false, mutateAsync: transfer } }}
        onClose={vi.fn()}
        wallets={wallets}
      />,
    )

    expect(within(screen.getByLabelText('To wallet')).getByRole('option', { name: 'Cash' })).toBeDisabled()
    await user.type(screen.getByLabelText('Amount (₹)'), '1000')
    await user.type(screen.getByLabelText('Note (optional)'), 'Move savings')
    await user.click(screen.getByRole('button', { name: 'Transfer money' }))

    await waitFor(() => expect(transfer).toHaveBeenCalledOnce())
    expect(transfer).toHaveBeenCalledWith({
      fromWalletId: 'cash-id',
      toWalletId: 'upi-id',
      amount: 100000,
      note: 'Move savings',
    })
  })

  it('explains that two wallets are required', () => {
    render(
      <TransferForm
        mutations={{ transfer: { isPending: false, mutateAsync: vi.fn() } }}
        onClose={vi.fn()}
        wallets={[{ _id: 'cash-id', name: 'Cash' }]}
      />,
    )

    expect(screen.getByText('Add at least two wallets before making a transfer.')).toBeInTheDocument()
  })

  it('rejects a zero-value transfer before calling the API', async () => {
    const user = userEvent.setup()
    const transfer = vi.fn().mockResolvedValue({})

    render(
      <TransferForm
        mutations={{ transfer: { isPending: false, mutateAsync: transfer } }}
        onClose={vi.fn()}
        wallets={[
          { id: 'cash-id', name: 'Cash' },
          { id: 'upi-id', name: 'UPI' },
        ]}
      />,
    )

    await user.type(screen.getByLabelText('Amount (₹)'), '0')
    await user.click(screen.getByRole('button', { name: 'Transfer money' }))

    expect(await screen.findByText('Amount must be greater than zero and within the allowed limit')).toBeInTheDocument()
    expect(transfer).not.toHaveBeenCalled()
  })

  it('shows a transfer API failure without closing the form', async () => {
    const user = userEvent.setup()
    const transfer = vi.fn().mockRejectedValue({ code: 'ERR_NETWORK' })

    render(
      <TransferForm
        mutations={{ transfer: { isPending: false, mutateAsync: transfer } }}
        onClose={vi.fn()}
        wallets={[
          { id: 'cash-id', name: 'Cash' },
          { id: 'upi-id', name: 'UPI' },
        ]}
      />,
    )

    await user.type(screen.getByLabelText('Amount (₹)'), '50')
    await user.click(screen.getByRole('button', { name: 'Transfer money' }))

    expect(await screen.findByRole('alert')).toHaveTextContent("Can't reach the server. Is the backend running?")
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
