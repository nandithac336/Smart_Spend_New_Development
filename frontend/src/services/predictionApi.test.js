import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from './api.js'
import {
  getCategoryPredictions,
  getDailyPredictions,
  getExpensePredictionData,
  getPredictionOverview,
} from './predictionApi.js'

vi.mock('./api.js', () => ({ default: { get: vi.fn() } }))

describe('prediction API', () => {
  beforeEach(() => api.get.mockReset())

  it('uses the existing authenticated prediction endpoints and response envelope', async () => {
    api.get.mockResolvedValue({ data: { data: { status: 'ok' } } })

    await expect(getPredictionOverview()).resolves.toEqual({ status: 'ok' })
    await expect(getCategoryPredictions('2026-11')).resolves.toEqual({ status: 'ok' })
    await expect(getDailyPredictions('2026-11')).resolves.toEqual({ status: 'ok' })

    expect(api.get).toHaveBeenNthCalledWith(1, '/predictions/overview', { params: undefined })
    expect(api.get).toHaveBeenNthCalledWith(2, '/predictions/categories', { params: { month: '2026-11' } })
    expect(api.get).toHaveBeenNthCalledWith(3, '/predictions/daily', { params: { month: '2026-11' } })
  })

  it('loads categories and daily data for the current period provided by the overview', async () => {
    api.get
      .mockResolvedValueOnce({ data: { data: { currentMonth: { forecastPeriod: '2026-11' } } } })
      .mockResolvedValueOnce({ data: { data: { categories: [] } } })
      .mockResolvedValueOnce({ data: { data: { data: [] } } })

    const data = await getExpensePredictionData()

    expect(data.selectedMonth).toBe('2026-11')
    expect(api.get).toHaveBeenNthCalledWith(2, '/predictions/categories', { params: { month: '2026-11' } })
    expect(api.get).toHaveBeenNthCalledWith(3, '/predictions/daily', { params: { month: '2026-11' } })
  })

})
