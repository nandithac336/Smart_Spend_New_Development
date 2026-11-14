import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TransactionForm from './TransactionForm.jsx'

vi.mock('@/hooks/useWallets.js', () => ({
  useWallets: () => ({
    data: [{ id: '0123456789abcdef01234567', name: 'Cash' }],
    isLoading: false,
  }),
}))

vi.mock('@/hooks/useCategories.js', () => ({
  useCategories: () => ({
    data: [{ id: 'abcdef0123456789abcdef01', name: 'Food', icon: '🍲' }],
    isLoading: false,
  }),
}))
vi.mock('@/hooks/useCreateCategory.js', () => ({
  useCreateCategory: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))
vi.mock('@/hooks/useAuth.js', () => ({ useAuth: () => ({ user: null }) }))

describe('TransactionForm', () => {
  afterEach(cleanup)

  beforeEach(() => {
    Object.defineProperties(HTMLElement.prototype, {
      hasPointerCapture: { configurable: true, value: () => false },
      setPointerCapture: { configurable: true, value: () => {} },
      releasePointerCapture: { configurable: true, value: () => {} },
      scrollIntoView: { configurable: true, value: () => {} },
    })
    Object.defineProperty(window.crypto, 'randomUUID', {
      configurable: true,
      value: vi.fn(() => 'a4b91740-2c12-4f97-9d98-b4fda4402222'),
    })
  })

  it('sends a rupee amount as exact paise and reuses the client id after a failed save', async () => {
    const user = userEvent.setup()
    const mutateAsync = vi.fn()
      .mockRejectedValueOnce(new Error('Network unavailable'))
      .mockResolvedValueOnce({ duplicate: false })
    const mutations = {
      create: { isPending: false, mutateAsync },
      update: { isPending: false, mutateAsync: vi.fn() },
    }
    const onClose = vi.fn()
    render(<TransactionForm mutations={mutations} onClose={onClose} timeZone="Asia/Kolkata" />)

    await user.type(screen.getByLabelText('Amount (₹)'), '120.50')
    await user.click(screen.getByRole('combobox', { name: 'Wallet' }))
    await user.click(screen.getByRole('option', { name: 'Cash' }))
    await user.type(screen.getByLabelText('Merchant'), 'Lunch')
    await user.type(screen.getByLabelText('Tags (comma separated)'), 'food, work')
    const submit = screen.getByRole('button', { name: 'Add transaction' })

    await user.click(submit)
    await user.click(submit)

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(2))
    const firstPayload = mutateAsync.mock.calls[0][0]
    const secondPayload = mutateAsync.mock.calls[1][0]
    expect(firstPayload).toMatchObject({
      amount: 12050,
      walletId: '0123456789abcdef01234567',
      merchant: 'Lunch',
      tags: ['food', 'work'],
      type: 'expense',
      clientId: 'a4b91740-2c12-4f97-9d98-b4fda4402222',
    })
    expect(secondPayload.clientId).toBe(firstPayload.clientId)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('sends only changed fields when editing a transaction', async () => {
    const user = userEvent.setup()
    const update = vi.fn().mockResolvedValue({})
    const mutations = {
      create: { isPending: false, mutateAsync: vi.fn() },
      update: { isPending: false, mutateAsync: update },
    }
    render(
      <TransactionForm
        mutations={mutations}
        onClose={vi.fn()}
        timeZone="Asia/Kolkata"
        transaction={{
          id: '0123456789abcdef01234567',
          type: 'expense',
          amount: 12050,
          walletId: { id: '0123456789abcdef01234567', name: 'Cash' },
          categoryId: { id: 'abcdef0123456789abcdef01', name: 'Food' },
          merchant: 'Lunch',
          note: '',
          tags: [],
          paymentMethod: 'cash',
          txnDate: '2026-10-20T06:30:45.123Z',
        }}
      />,
    )

    fireEvent.change(screen.getByLabelText('Amount (₹)'), { target: { value: '121.50' } })
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(update).toHaveBeenCalledOnce())
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      id: '0123456789abcdef01234567',
      payload: { amount: 12150 },
      transaction: expect.objectContaining({ type: 'expense' }),
    }))
  })
})
