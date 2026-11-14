import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import RecurringForm from './RecurringForm.jsx'

vi.mock('@/hooks/useWallets.js', () => ({
  useWallets: () => ({
    data: { wallets: [{ id: 'wallet-1', name: 'Daily wallet' }] },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}))

vi.mock('@/hooks/useCategories.js', () => ({
  useCategories: () => ({
    data: [{ id: 'category-1', name: 'Bills', icon: '🏠' }],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}))

afterEach(cleanup)

function mutations() {
  return {
    create: { isPending: false, mutateAsync: vi.fn().mockResolvedValue({}) },
    update: { isPending: false, mutateAsync: vi.fn().mockResolvedValue({}) },
  }
}

describe('RecurringForm', () => {
  it('creates a monthly expense schedule with paise amounts and supported fields', async () => {
    const user = userEvent.setup()
    const actions = mutations()
    render(<RecurringForm mutations={actions} onClose={vi.fn()} today="2026-11-09" />)

    await user.type(screen.getByLabelText('Schedule name'), 'Monthly rent')
    await user.type(screen.getByLabelText('Amount (₹)'), '1250.50')
    await user.selectOptions(screen.getByLabelText('Wallet'), 'wallet-1')
    await user.selectOptions(screen.getByLabelText('Category (optional)'), 'category-1')
    await user.type(screen.getByLabelText('Description (optional)'), 'Apartment')
    await user.click(screen.getByRole('button', { name: 'Create schedule' }))

    await waitFor(() => expect(actions.create.mutateAsync).toHaveBeenCalledWith({
      name: 'Monthly rent',
      type: 'expense',
      amount: 125_050,
      walletId: 'wallet-1',
      categoryId: 'category-1',
      description: 'Apartment',
      frequency: 'monthly',
      startDate: '2026-11-09',
      endDate: null,
    }))
  })

  it('sends only changed fields while editing', async () => {
    const user = userEvent.setup()
    const actions = mutations()
    render(
      <RecurringForm
        mutations={actions}
        onClose={vi.fn()}
        schedule={{
          id: 'schedule-1',
          name: 'Monthly rent',
          type: 'expense',
          amount: 125_000,
          walletId: { id: 'wallet-1', name: 'Daily wallet' },
          categoryId: { id: 'category-1', name: 'Bills' },
          description: '',
          frequency: 'monthly',
          startDate: '2026-11-09T00:00:00.000Z',
          nextDueDate: '2026-11-09T00:00:00.000Z',
          endDate: null,
          status: 'active',
        }}
        today="2026-11-09"
      />,
    )
    const amount = screen.getByLabelText('Amount (₹)')
    await user.clear(amount)
    await user.type(amount, '1300')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(actions.update.mutateAsync).toHaveBeenCalledWith({
      id: 'schedule-1',
      payload: { amount: 130_000 },
    }))
  })

  it('validates an end date that occurs before the first due date', async () => {
    const user = userEvent.setup()
    const actions = mutations()
    render(<RecurringForm mutations={actions} onClose={vi.fn()} today="2026-11-09" />)
    await user.type(screen.getByLabelText('Schedule name'), 'Rent')
    await user.type(screen.getByLabelText('Amount (₹)'), '1000')
    await user.selectOptions(screen.getByLabelText('Wallet'), 'wallet-1')
    await user.clear(screen.getByLabelText('End date (optional)'))
    await user.type(screen.getByLabelText('End date (optional)'), '2026-11-08')
    await user.click(screen.getByRole('button', { name: 'Create schedule' }))

    expect(await screen.findByText('End date must be on or after start date')).toBeInTheDocument()
    expect(actions.create.mutateAsync).not.toHaveBeenCalled()
  })
})
