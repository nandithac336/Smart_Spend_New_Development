import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import GoalContributionForm from './GoalContributionForm.jsx'

afterEach(cleanup)

describe('GoalContributionForm', () => {
  it('records a bounded contribution in paise and clarifies that no wallet transfer occurs', async () => {
    const user = userEvent.setup()
    const mutateAsync = vi.fn().mockResolvedValue({})
    const mutations = { contribute: { isPending: false, mutateAsync } }
    render(
      <GoalContributionForm
        goal={{ id: 'goal-1', name: 'Trip', targetAmount: 10_000, savedAmount: 2_000, progress: { remainingAmount: 8_000 } }}
        mutations={mutations}
        onClose={vi.fn()}
        today="2026-11-09"
      />,
    )

    expect(screen.getByText(/does not move money between wallets/)).toBeInTheDocument()
    await user.type(screen.getByLabelText('Contribution amount (₹)'), '25.50')
    await user.type(screen.getByLabelText('Note (optional)'), 'Monthly deposit')
    await user.click(screen.getByRole('button', { name: 'Record contribution' }))

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({
      id: 'goal-1',
      payload: {
        amount: 2_550,
        contributionDate: '2026-11-09',
        note: 'Monthly deposit',
      },
    }))
  })

  it('blocks a contribution greater than the remaining goal amount', async () => {
    const user = userEvent.setup()
    const mutateAsync = vi.fn()
    render(
      <GoalContributionForm
        goal={{ id: 'goal-1', name: 'Trip', targetAmount: 10_000, savedAmount: 9_000, progress: { remainingAmount: 1_000 } }}
        mutations={{ contribute: { isPending: false, mutateAsync } }}
        onClose={vi.fn()}
        today="2026-11-09"
      />,
    )
    await user.type(screen.getByLabelText('Contribution amount (₹)'), '20')
    await user.click(screen.getByRole('button', { name: 'Record contribution' }))

    expect(await screen.findByText('Enter an amount up to the remaining target')).toBeInTheDocument()
    expect(mutateAsync).not.toHaveBeenCalled()
  })
})
