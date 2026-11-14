import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from './api.js'
import { detectAnomalies, getAnomalySummary, listAnomalies, updateAnomalyStatus } from './anomalyApi.js'

vi.mock('./api.js', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }))

describe('anomaly API', () => {
  beforeEach(() => vi.clearAllMocks())

  it('uses the supported list and summary endpoints with backend pagination', async () => {
    const anomalies = [{ _id: 'anomaly-1', score: 48, severity: 'medium' }]
    const pagination = { page: 1, limit: 20, total: 1, pages: 1 }
    api.get.mockResolvedValueOnce({ data: { data: anomalies, pagination } })
    api.get.mockResolvedValueOnce({ data: { data: { total: 1, new: 1, highAndCritical: 0 } } })

    await expect(listAnomalies({ severity: 'medium', status: 'new', page: 1, limit: 20 }))
      .resolves.toEqual({ anomalies, pagination })
    await expect(getAnomalySummary()).resolves.toMatchObject({ total: 1, new: 1 })

    expect(api.get).toHaveBeenNthCalledWith(1, '/anomalies', {
      params: { severity: 'medium', status: 'new', page: 1, limit: 20 },
    })
    expect(api.get).toHaveBeenNthCalledWith(2, '/anomalies/summary')
  })

  it('runs detection and submits only the supported status update payload', async () => {
    api.post.mockResolvedValue({ data: { data: { scannedCount: 2, anomalies: [] } } })
    api.patch.mockResolvedValue({ data: { data: { _id: 'anomaly-1', status: 'reviewed' } } })

    await expect(detectAnomalies({ startDate: '2026-11-01', endDate: '2026-11-10' }))
      .resolves.toMatchObject({ scannedCount: 2 })
    await expect(updateAnomalyStatus('anomaly-1', 'reviewed')).resolves.toMatchObject({ status: 'reviewed' })

    expect(api.post).toHaveBeenCalledWith('/anomalies/detect', { startDate: '2026-11-01', endDate: '2026-11-10' })
    expect(api.patch).toHaveBeenCalledWith('/anomalies/anomaly-1/status', { status: 'reviewed' })
  })
})
