import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Budgets from './Budgets.jsx'
import { currentMonthInTimeZone } from '@/lib/budgetHelpers.js'

const state = vi.hoisted(() => ({
  query: null,
  mutations: null,
}))

vi.mock('@/hooks/useAuth.js', () => ({ useAuth: () => ({ user: { timezone: 'Asia/Kolkata' } }) }))
vi.mock('@/hooks/useBudgets.js', () => ({ useBudgets: () => state.query }))
vi.mock('@/hooks/useCategories.js', () => ({ useCategories: () => ({ data: [{ id: 'food', name: 'Food', icon: '🍲' }] }) }))
vi.mock('@/hooks/useBudgetMutations.js', () => ({ useBudgetMutations: () => state.mutations }))

afterEach(cleanup)

function fixture() {
  const month = currentMonthInTimeZone('Asia/Kolkata')
  const [year, value] = month.split('-').map(Number)
  const endDate = new Date(Date.UTC(year, value, 0)).toISOString()
  return {
    month,
    data: {
      summary: { budgetCount: 1, totalBudgetAmount: 100_000, totalActualSpending: 85_000, totalRemainingAmount: 15_000 },
      budgets: [{
        id: 'budget-1',
        name: 'Food',
        amount: 100_000,
        categoryId: 'food',
        period: 'monthly',
        startDate: `${month}-01T00:00:00.000Z`,
        endDate,
        progress: {
          budgetAmount: 100_000,
          actualSpending: 85_000,
          remainingAmount: 15_000,
          percentageUsed: 85,
          isApproachingLimit: true,
        },
      }],
    },
  }
}

function setup(query = { isPending: false, isError: false, refetch: vi.fn() }) {
  const actions = {
    create: { isPending: false, mutateAsync: vi.fn().mockResolvedValue({}) },
    update: { isPending: false, mutateAsync: vi.fn().mockResolvedValue({}) },
    archive: {
      isPending: false,
      mutate: vi.fn((_id, options) => options?.onSuccess?.()),
    },
  }
  state.query = query
  state.mutations = actions
  return { actions }
}

describe('Budgets page', () => {
  beforeEach(() => {
    const { data } = fixture()
    setup({ data, isPending: false, isError: false, refetch: vi.fn() })
  })

  it('shows backend category spending, totals, and approaching-limit progress', () => {
    const { data } = fixture()
    state.query = { data, isPending: false, isError: false, refetch: vi.fn() }
    render(<Budgets />)

    expect(screen.getAllByText('₹1,000')).toHaveLength(2)
    expect(screen.getAllByText('₹850')).toHaveLength(2)
    expect(screen.getByText('Approaching limit')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '85')
  })

  it('opens the create form and archives through the existing delete endpoint action', async () => {
    const user = userEvent.setup()
    const { actions } = setup({ ...state.query, isPending: false, isError: false })
    const { data } = fixture()
    state.query = { data, isPending: false, isError: false, refetch: vi.fn() }
    render(<Budgets />)

    await user.click(screen.getByRole('button', { name: 'Create budget' }))
    expect(screen.getByRole('heading', { name: 'Create budget' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await user.click(screen.getByRole('button', { name: 'Archive Food' }))
    expect(screen.getByRole('heading', { name: 'Archive this budget?' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Archive budget' }))

    await waitFor(() => expect(actions.archive.mutate).toHaveBeenCalledWith('budget-1', expect.any(Object)))
  })

  it('shows empty, loading, and error states', async () => {
    state.query = { data: { budgets: [] }, isPending: false, isError: false, refetch: vi.fn() }
    const { rerender } = render(<Budgets />)
    expect(screen.getByText('No budgets for this month')).toBeInTheDocument()

    state.query = { data: undefined, isPending: true, isError: false, refetch: vi.fn() }
    rerender(<Budgets />)
    expect(screen.getByLabelText('Loading budgets')).toBeInTheDocument()

    const refetch = vi.fn()
    state.query = { data: undefined, isPending: false, isError: true, refetch }
    rerender(<Budgets />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }))
    expect(refetch).toHaveBeenCalledOnce()
  })

  it('filters visible budgets by the selected month', () => {
    const { data } = fixture()
    data.budgets.push({
      ...data.budgets[0],
      id: 'budget-next-month',
      name: 'Next month',
      startDate: '2099-01-01T00:00:00.000Z',
      endDate: '2099-01-31T00:00:00.000Z',
    })
    state.query = { data, isPending: false, isError: false, refetch: vi.fn() }
    render(<Budgets />)
    const input = screen.getByLabelText('Select budget month')
    fireEvent.change(input, { target: { value: '2099-01' } })
    expect(screen.getByRole('heading', { name: 'Next month' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Food' })).not.toBeInTheDocument()
  })
})
