import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import RecurringCard from './RecurringCard.jsx'

afterEach(cleanup)

const baseSchedule = {
  id: 'schedule-1',
  name: 'Monthly rent',
  type: 'expense',
  amount: 125_050,
  frequency: 'monthly',
  startDate: '2026-11-05T00:00:00.000Z',
  nextDueDate: '2026-12-05T00:00:00.000Z',
  status: 'active',
  description: 'Apartment',
  walletId: { name: 'Daily wallet' },
  categoryId: { name: 'Bills', icon: '🏠' },
}

describe('RecurringCard', () => {
  it('shows a scheduled plan and exposes pause, edit, cancel, and generated-history actions', () => {
    const onHistory = vi.fn()
    render(
      <RecurringCard
        onCancel={vi.fn()}
        onEdit={vi.fn()}
        onHistory={onHistory}
        onPause={vi.fn()}
        onResume={vi.fn()}
        schedule={baseSchedule}
        today="2026-11-09"
      />,
    )

    expect(screen.getByText('−₹1,250.5')).toBeInTheDocument()
    expect(screen.getByText('5 Dec 2026')).toBeInTheDocument()
    expect(screen.getByText('Bills · Daily wallet')).toBeInTheDocument()
    screen.getByRole('button', { name: 'Created history' }).click()
    expect(onHistory).toHaveBeenCalledWith(baseSchedule)
    expect(screen.getByRole('button', { name: 'Pause Monthly rent' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel Monthly rent' })).toBeInTheDocument()
  })

  it('shows resume for paused schedules and no schedule controls for ended schedules', () => {
    const { rerender } = render(
      <RecurringCard
        onCancel={vi.fn()}
        onEdit={vi.fn()}
        onHistory={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        schedule={{ ...baseSchedule, status: 'paused' }}
        today="2026-11-09"
      />,
    )
    expect(screen.getByRole('button', { name: 'Resume Monthly rent' })).toBeInTheDocument()

    rerender(
      <RecurringCard
        onCancel={vi.fn()}
        onEdit={vi.fn()}
        onHistory={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        schedule={{ ...baseSchedule, status: 'cancelled' }}
        today="2026-11-09"
      />,
    )
    expect(screen.queryByRole('button', { name: 'Resume Monthly rent' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit Monthly rent' })).not.toBeInTheDocument()
  })
})
