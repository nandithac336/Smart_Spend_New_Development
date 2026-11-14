import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import GoalForm from './GoalForm.jsx'

afterEach(cleanup)

function mutations() {
  return {
    create: { isPending: false, mutateAsync: vi.fn().mockResolvedValue({}) },
    update: { isPending: false, mutateAsync: vi.fn().mockResolvedValue({}) },
  }
}

describe('GoalForm', () => {
  it('creates a goal with the target amount converted to paise', async () => {
    const user = userEvent.setup()
    const actions = mutations()
    render(<GoalForm mutations={actions} onClose={vi.fn()} />)
    await user.type(screen.getByLabelText('Goal name'), 'Travel')
    await user.type(screen.getByLabelText('Target amount (₹)'), '25000.75')
    await user.type(screen.getByLabelText('Target date'), '2027-08-01')
    await user.click(screen.getByRole('button', { name: 'Create goal' }))

    await waitFor(() => expect(actions.create.mutateAsync).toHaveBeenCalledWith({
      name: 'Travel',
      description: '',
      targetAmount: 2_500_075,
      targetDate: '2027-08-01',
    }))
  })

  it('prevents reducing the target below the amount already saved', async () => {
    const user = userEvent.setup()
    const actions = mutations()
    render(
      <GoalForm
        goal={{
          id: 'goal-1',
          name: 'Trip',
          description: '',
          targetAmount: 50_000,
          savedAmount: 40_000,
          targetDate: '2027-08-01T00:00:00.000Z',
        }}
        mutations={actions}
        onClose={vi.fn()}
      />,
    )
    const target = screen.getByLabelText('Target amount (₹)')
    await user.clear(target)
    await user.type(target, '300')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('Target cannot be less than the amount already saved')).toBeInTheDocument()
    expect(actions.update.mutateAsync).not.toHaveBeenCalled()
  })
})
