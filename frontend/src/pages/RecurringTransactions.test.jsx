import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import RecurringTransactions from './RecurringTransactions.jsx'

const state = vi.hoisted(() => ({
  query: null,
  history: null,
  mutations: null,
}))

vi.mock('@/hooks/useAuth.js', () => ({ useAuth: () => ({ user: { timezone: 'Asia/Kolkata' } }) }))
vi.mock('@/hooks/useRecurringTransactions.js', () => ({ useRecurringTransactions: () => state.query }))
vi.mock('@/hooks/useRecurringHistory.js', () => ({ useRecurringHistory: () => state.history }))
vi.mock('@/hooks/useRecurringMutations.js', () => ({ useRecurringMutations: () => state.mutations }))
vi.mock('@/hooks/useWallets.js', () => ({
  useWallets: () => ({
    data: { wallets: [{ id: 'wallet-1', name: 'Daily wallet' }] },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}))
vi.mock('@/hooks/useCategories.js', () => ({
  useCategories: () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }),
}))

afterEach(cleanup)

function fixture() {
  const schedule = {
    id: 'schedule-1',
    name: 'Monthly rent',
    type: 'expense',
    amount: 125_000,
    frequency: 'monthly',
    startDate: '2026-11-05T00:00:00.000Z',
    nextDueDate: '2026-12-05T00:00:00.000Z',
    status: 'active',
    description: 'Apartment',
    walletId: { id: 'wallet-1', name: 'Daily wallet' },
    categoryId: { id: 'category-1', name: 'Bills' },
  }
  return {
    schedules: [
      schedule,
      { ...schedule, id: 'schedule-2', name: 'Internet', status: 'paused', nextDueDate: '2026-11-20T00:00:00.000Z' },
      { ...schedule, id: 'schedule-3', name: 'Old rent', status: 'cancelled' },
    ],
  }
}

function setup(query = { data: fixture().schedules, isPending: false, isError: false, refetch: vi.fn() }) {
  const actions = {
    create: { isPending: false, mutateAsync: vi.fn().mockResolvedValue({}) },
    update: { isPending: false, mutateAsync: vi.fn().mockResolvedValue({}) },
    pause: { isPending: false, mutate: vi.fn((_id, options) => options?.onSuccess?.()) },
    resume: { isPending: false, mutate: vi.fn((_id, options) => options?.onSuccess?.()) },
    cancel: { isPending: false, mutate: vi.fn((_id, options) => options?.onSuccess?.()) },
  }
  state.query = query
  state.history = { data: [], isPending: false, isError: false, refetch: vi.fn() }
  state.mutations = actions
  return { actions }
}

describe('RecurringTransactions page', () => {
  beforeEach(() => setup())

  it('shows active, paused, and cancelled schedules separately', () => {
    render(<RecurringTransactions />)

    expect(screen.getByRole('region', { name: 'Active schedules' })).toHaveTextContent('Monthly rent')
    expect(screen.getByRole('region', { name: 'Paused schedules' })).toHaveTextContent('Internet')
    expect(screen.getByRole('region', { name: 'Completed and cancelled' })).toHaveTextContent('Old rent')
    expect(screen.getByText(/Creating a schedule does not create a transaction immediately/)).toBeInTheDocument()
  })

  it('supports pausing, resuming, cancelling, and reviewing generated history', async () => {
    const user = userEvent.setup()
    const { actions } = setup()
    render(<RecurringTransactions />)

    await user.click(screen.getByRole('button', { name: 'Pause Monthly rent' }))
    expect(actions.pause.mutate).toHaveBeenCalledWith('schedule-1', expect.any(Object))
    await user.click(screen.getByRole('button', { name: 'Resume Internet' }))
    expect(actions.resume.mutate).toHaveBeenCalledWith('schedule-2', expect.any(Object))
    await user.click(screen.getByRole('button', { name: 'Cancel Monthly rent' }))
    expect(screen.getByRole('heading', { name: 'Cancel this recurring schedule?' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancel schedule' }))
    expect(actions.cancel.mutate).toHaveBeenCalledWith('schedule-1', expect.any(Object))

    await user.click(screen.getAllByRole('button', { name: 'Created history' })[0])
    expect(screen.getByRole('heading', { name: 'Created transactions' })).toBeInTheDocument()
    expect(screen.getByText('Nothing generated yet')).toBeInTheDocument()
  })

  it('opens the create form and shows loading, error, and empty states', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<RecurringTransactions />)
    await user.click(screen.getByRole('button', { name: 'Add schedule' }))
    expect(screen.getByRole('heading', { name: 'Add recurring schedule' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    state.query = { data: undefined, isPending: true, isError: false, refetch: vi.fn() }
    rerender(<RecurringTransactions />)
    expect(screen.getByLabelText('Loading recurring schedules')).toBeInTheDocument()

    const refetch = vi.fn()
    state.query = { data: undefined, isPending: false, isError: true, refetch }
    rerender(<RecurringTransactions />)
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(refetch).toHaveBeenCalledOnce()

    state.query = { data: [], isPending: false, isError: false, refetch: vi.fn() }
    rerender(<RecurringTransactions />)
    expect(screen.getByText('No recurring schedules yet')).toBeInTheDocument()
  })
})
