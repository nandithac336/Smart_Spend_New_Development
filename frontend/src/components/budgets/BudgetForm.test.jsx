import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import BudgetForm from './BudgetForm.jsx'

vi.mock('@/hooks/useCategories.js', () => ({
  useCategories: () => ({
    data: [{ id: 'category-1', name: 'Food', icon: '🍲' }],
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

describe('BudgetForm', () => {
  it('creates a monthly budget using paise and the complete selected calendar month', async () => {
    const user = userEvent.setup()
    const actions = mutations()
    const onClose = vi.fn()
    render(<BudgetForm month="2026-11" mutations={actions} onClose={onClose} />)

    await user.type(screen.getByLabelText('Budget name'), 'Food')
    await user.type(screen.getByLabelText('Limit (₹)'), '1200.50')
    await user.selectOptions(screen.getByLabelText('Expense category'), 'category-1')
    await user.click(screen.getByRole('button', { name: 'Create budget' }))

    await waitFor(() => expect(actions.create.mutateAsync).toHaveBeenCalledWith({
      name: 'Food',
      amount: 120_050,
      categoryId: 'category-1',
      period: 'monthly',
      startDate: '2026-11-01',
      endDate: '2026-11-30',
    }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('edits an existing budget using the supported update fields', async () => {
    const user = userEvent.setup()
    const actions = mutations()
    render(
      <BudgetForm
        budget={{
          id: 'budget-1',
          name: 'Old name',
          amount: 50_000,
          categoryId: 'category-1',
          period: 'monthly',
          startDate: '2026-11-01T00:00:00.000Z',
          endDate: '2026-11-30T00:00:00.000Z',
        }}
        month="2026-11"
        mutations={actions}
        onClose={vi.fn()}
      />,
    )
    const name = screen.getByLabelText('Budget name')
    await user.clear(name)
    await user.type(name, 'Updated food')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(actions.update.mutateAsync).toHaveBeenCalledWith({
      id: 'budget-1',
      payload: {
        name: 'Updated food',
        amount: 50_000,
        categoryId: 'category-1',
        period: 'monthly',
        startDate: '2026-11-01',
        endDate: '2026-11-30',
      },
    }))
  })

  it('shows required-field validation and does not send an invalid budget', async () => {
    const user = userEvent.setup()
    const actions = mutations()
    render(<BudgetForm month="2026-11" mutations={actions} onClose={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Create budget' }))

    expect(await screen.findByText('Enter a budget name')).toBeInTheDocument()
    expect(actions.create.mutateAsync).not.toHaveBeenCalled()
  })
})
