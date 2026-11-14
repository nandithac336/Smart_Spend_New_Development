import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Goals from './Goals.jsx'

const state = vi.hoisted(() => ({
  query: null,
  mutations: null,
}))

vi.mock('@/hooks/useAuth.js', () => ({ useAuth: () => ({ user: { timezone: 'Asia/Kolkata' } }) }))
vi.mock('@/hooks/useGoals.js', () => ({ useGoals: () => state.query }))
vi.mock('@/hooks/useGoalMutations.js', () => ({ useGoalMutations: () => state.mutations }))

afterEach(cleanup)

function goalsFixture() {
  return {
    summary: {
      goalCount: 2,
      activeCount: 1,
      pausedCount: 0,
      completedCount: 1,
      totalTargetAmount: 200_000,
      totalSavedAmount: 100_000,
      totalRemainingAmount: 100_000,
    },
    goals: [
      {
        id: 'goal-1',
        name: 'Travel',
        description: '',
        targetDate: '2027-10-01T00:00:00.000Z',
        status: 'active',
        targetAmount: 100_000,
        savedAmount: 40_000,
        progress: { targetAmount: 100_000, savedAmount: 40_000, remainingAmount: 60_000, percentageComplete: 40 },
      },
      {
        id: 'goal-2',
        name: 'Laptop',
        description: '',
        targetDate: '2026-10-01T00:00:00.000Z',
        status: 'completed',
        targetAmount: 100_000,
        savedAmount: 100_000,
        progress: { targetAmount: 100_000, savedAmount: 100_000, remainingAmount: 0, percentageComplete: 100, isCompleted: true },
      },
    ],
  }
}

function setup(query = { data: goalsFixture(), isPending: false, isError: false, refetch: vi.fn() }) {
  const actions = {
    create: { isPending: false, mutateAsync: vi.fn().mockResolvedValue({}) },
    update: { isPending: false, mutateAsync: vi.fn().mockResolvedValue({}) },
    contribute: { isPending: false, mutateAsync: vi.fn().mockResolvedValue({}) },
    archive: { isPending: false, mutate: vi.fn((_id, options) => options?.onSuccess?.()) },
    pause: { isPending: false, mutate: vi.fn() },
    resume: { isPending: false, mutate: vi.fn() },
  }
  state.query = query
  state.mutations = actions
  return { actions }
}

describe('Savings goals page', () => {
  beforeEach(() => setup())

  it('shows actual saved amounts, progress, and active/completed goal states', () => {
    render(<Goals />)

    expect(screen.getAllByText('₹1,000').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('₹400')).toBeInTheDocument()
    expect(screen.getByText('Goal reached')).toBeInTheDocument()
    expect(screen.getByText('1 active · 0 paused · 1 completed')).toBeInTheDocument()
  })

  it('opens and submits a contribution without claiming to transfer wallet funds', async () => {
    const user = userEvent.setup()
    const { actions } = setup()
    render(<Goals />)

    await user.click(screen.getByRole('button', { name: 'Add money' }))
    expect(screen.getByText(/does not move money between wallets/)).toBeInTheDocument()
    await user.type(screen.getByLabelText('Contribution amount (₹)'), '50')
    await user.click(screen.getByRole('button', { name: 'Record contribution' }))

    await waitFor(() => expect(actions.contribute.mutateAsync).toHaveBeenCalledWith({
      id: 'goal-1',
      payload: {
        amount: 5_000,
        contributionDate: expect.any(String),
        note: '',
      },
    }))
  })

  it('opens goal creation and archives through the existing soft-delete contract', async () => {
    const user = userEvent.setup()
    const { actions } = setup()
    render(<Goals />)
    await user.click(screen.getByRole('button', { name: 'Create goal' }))
    expect(screen.getByRole('heading', { name: 'Create savings goal' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await user.click(screen.getByRole('button', { name: 'Archive Travel' }))
    await user.click(screen.getByRole('button', { name: 'Archive goal' }))
    await waitFor(() => expect(actions.archive.mutate).toHaveBeenCalledWith('goal-1', expect.any(Object)))
  })

  it('shows empty, loading, and error states', async () => {
    state.query = { data: { summary: {}, goals: [] }, isPending: false, isError: false, refetch: vi.fn() }
    const { rerender } = render(<Goals />)
    expect(screen.getByText('No savings goals yet')).toBeInTheDocument()

    state.query = { data: undefined, isPending: true, isError: false, refetch: vi.fn() }
    rerender(<Goals />)
    expect(screen.getByLabelText('Loading savings goals')).toBeInTheDocument()

    const refetch = vi.fn()
    state.query = { data: undefined, isPending: false, isError: true, refetch }
    rerender(<Goals />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }))
    expect(refetch).toHaveBeenCalledOnce()
  })
})
