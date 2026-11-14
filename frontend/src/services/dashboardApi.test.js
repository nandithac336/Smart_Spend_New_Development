import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from './api.js'
import { getDashboard } from './dashboardApi.js'

vi.mock('./api.js', () => ({ default: { get: vi.fn() } }))

describe('dashboard API', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sends a selected calendar date to the existing dashboard endpoint', async () => {
    api.get.mockResolvedValue({ data: { data: { selectedDateSpent: 250 } } })
    await expect(getDashboard('2024-02-29')).resolves.toEqual({ selectedDateSpent: 250 })
    expect(api.get).toHaveBeenCalledWith('/dashboard', { params: { date: '2024-02-29' } })
  })
})
