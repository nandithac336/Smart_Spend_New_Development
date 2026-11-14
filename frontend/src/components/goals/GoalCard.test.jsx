import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import GoalCard from './GoalCard.jsx'

afterEach(cleanup)

const baseGoal = {
  id: 'goal-1',
  name: 'Emergency fund',
  description: 'A rainy-day reserve',
  targetDate: '2027-06-01T00:00:00.000Z',
  status: 'active',
  targetAmount: 100_000,
  savedAmount: 40_000,
  progress: {
    targetAmount: 100_000,
    savedAmount: 40_000,
    remainingAmount: 60_000,
    percentageComplete: 40,
    requiredMonthlySavings: 10_000,
  },
}

describe('GoalCard', () => {
  it('shows saved progress and allows recording a contribution', () => {
    const onContribute = vi.fn()
    render(<GoalCard goal={baseGoal} onArchive={vi.fn()} onContribute={onContribute} onEdit={vi.fn()} onPause={vi.fn()} onResume={vi.fn()} />)

    expect(screen.getByText('₹400')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '40')
    expect(screen.getByText(/Suggested monthly pace/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add money' })).toBeInTheDocument()
  })

  it('renders completed goals without an add-contribution action', () => {
    render(<GoalCard goal={{ ...baseGoal, status: 'completed', savedAmount: 100_000 }} onArchive={vi.fn()} onContribute={vi.fn()} onEdit={vi.fn()} onPause={vi.fn()} onResume={vi.fn()} />)

    expect(screen.getByText('Goal reached')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add money' })).not.toBeInTheDocument()
  })
})
