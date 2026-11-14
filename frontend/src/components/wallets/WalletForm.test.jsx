import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import WalletForm from './WalletForm.jsx'

describe('WalletForm', () => {
  afterEach(cleanup)

  it('creates a UPI wallet with the opening balance converted to paise', async () => {
    const user = userEvent.setup()
    const create = vi.fn().mockResolvedValue({})
    const onClose = vi.fn()

    render(
      <WalletForm
        mutations={{ create: { isPending: false, mutateAsync: create }, update: { isPending: false } }}
        onClose={onClose}
      />,
    )

    await user.type(screen.getByLabelText('Name'), 'Travel UPI')
    await user.selectOptions(screen.getByLabelText('Type'), 'upi')
    await user.clear(screen.getByLabelText('Opening balance (₹)'))
    await user.type(screen.getByLabelText('Opening balance (₹)'), '5000')
    await user.click(screen.getByRole('button', { name: 'Add wallet' }))

    await waitFor(() => expect(create).toHaveBeenCalledOnce())
    expect(create).toHaveBeenCalledWith({
      name: 'Travel UPI',
      type: 'upi',
      openingBalance: 500000,
    })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('normalizes a wallet _id when editing', async () => {
    const user = userEvent.setup()
    const update = vi.fn().mockResolvedValue({})

    render(
      <WalletForm
        mutations={{ create: { isPending: false }, update: { isPending: false, mutateAsync: update } }}
        onClose={vi.fn()}
        wallet={{ _id: 'wallet-id', name: 'Cash', type: 'cash', openingBalance: 1500 }}
      />,
    )

    await user.clear(screen.getByLabelText('Name'))
    await user.type(screen.getByLabelText('Name'), 'Daily Cash')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(update).toHaveBeenCalledOnce())
    expect(update).toHaveBeenCalledWith({
      id: 'wallet-id',
      payload: { name: 'Daily Cash', type: 'cash', openingBalance: 1500 },
    })
  })
})
