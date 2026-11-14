import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from './api.js'
import {
  addGoalContribution,
  archiveGoal,
  createGoal,
  getGoalsSummary,
  pauseGoal,
  resumeGoal,
  updateGoal,
} from './goalApi.js'

vi.mock('./api.js', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

describe('savings goal API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.get.mockResolvedValue({ data: { data: { goals: [] } } })
    api.post.mockResolvedValue({ data: { data: { goal: { id: 'goal-1' } } } })
    api.patch.mockResolvedValue({ data: { data: { id: 'goal-1' } } })
    api.delete.mockResolvedValue({ data: { data: { id: 'goal-1', status: 'archived' } } })
  })

  it('uses only the existing goals, contribution, status, and archive routes', async () => {
    await getGoalsSummary()
    await createGoal({ targetAmount: 100 })
    await updateGoal('goal-1', { name: 'Updated' })
    await addGoalContribution('goal-1', { amount: 20 })
    await pauseGoal('goal-1')
    await resumeGoal('goal-1')
    await archiveGoal('goal-1')

    expect(api.get).toHaveBeenCalledWith('/goals/summary')
    expect(api.post).toHaveBeenNthCalledWith(1, '/goals', { targetAmount: 100 })
    expect(api.patch).toHaveBeenNthCalledWith(1, '/goals/goal-1', { name: 'Updated' })
    expect(api.post).toHaveBeenNthCalledWith(2, '/goals/goal-1/contributions', { amount: 20 })
    expect(api.patch).toHaveBeenNthCalledWith(2, '/goals/goal-1/pause')
    expect(api.patch).toHaveBeenNthCalledWith(3, '/goals/goal-1/resume')
    expect(api.delete).toHaveBeenCalledWith('/goals/goal-1')
  })
})
