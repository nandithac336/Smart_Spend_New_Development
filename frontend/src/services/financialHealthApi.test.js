import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from './api.js'
import { getFinancialHealth } from './financialHealthApi.js'

vi.mock('./api.js', () => ({ default: { get: vi.fn() } }))

describe('financial health API', () => {
  beforeEach(() => api.get.mockReset())

  it('uses the authenticated score endpoint and unwraps the standard response envelope', async () => {
    const data = { score: 76, grade: 'good', dimensions: [] }
    api.get.mockResolvedValue({ data: { data } })

    await expect(getFinancialHealth()).resolves.toEqual(data)
    expect(api.get).toHaveBeenCalledOnce()
    expect(api.get).toHaveBeenCalledWith('/financial-health/score')
  })
})
