import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import BudgetCard from './BudgetCard.jsx'

afterEach(cleanup)

const budget = {
  id: 'budget-1',
  name: 'Food',
  amount: 100_000,
  period: 'monthly',
  categoryId: 'food-category',
  startDate: '2026-11-01T00:00:00.000Z',
  endDate: '2026-11-30T00:00:00.000Z',
  progress: {
    budgetAmount: 100_000,
    actualSpending: 110_000,
    remainingAmount: -10_000,
    percentageUsed: 110,
    isApproachingLimit: false,
    isExceeded: true,
  },
}

describe('BudgetCard', () => {
  it('shows backend spending, category, progress, and the overspend state', () => {
    render(<BudgetCard budget={budget} categories={[{ id: 'food-category', name: 'Food', icon: '🍲' }]} onArchive={vi.fn()} onEdit={vi.fn()} />)

    expect(screen.getByText('Food · Monthly · 2026-11-01 – 2026-11-30')).toBeInTheDocument()
    expect(screen.getByText(/Over budget by/)).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
    expect(screen.getByText(/-₹100/)).toBeInTheDocument()
  })
})
