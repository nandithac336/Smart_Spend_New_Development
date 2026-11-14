import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from './api.js'
import { archiveBudget, createBudget, getBudgetsSummary, updateBudget } from './budgetApi.js'

vi.mock('./api.js', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

describe('budget API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.get.mockResolvedValue({ data: { data: { budgets: [] } } })
    api.post.mockResolvedValue({ data: { data: { id: 'budget-1' } } })
    api.patch.mockResolvedValue({ data: { data: { id: 'budget-1' } } })
    api.delete.mockResolvedValue({ data: { data: { id: 'budget-1', status: 'archived' } } })
  })

  it('uses the existing budget summary and CRUD routes', async () => {
    await getBudgetsSummary()
    await createBudget({ amount: 100 })
    await updateBudget('budget-1', { amount: 200 })
    await archiveBudget('budget-1')

    expect(api.get).toHaveBeenCalledWith('/budgets/summary')
    expect(api.post).toHaveBeenCalledWith('/budgets', { amount: 100 })
    expect(api.patch).toHaveBeenCalledWith('/budgets/budget-1', { amount: 200 })
    expect(api.delete).toHaveBeenCalledWith('/budgets/budget-1')
  })
})
