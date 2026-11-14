import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from './api.js'
import {
  cancelSubscription,
  confirmSubscription,
  detectSubscriptions,
  dismissSubscription,
  getSubscriptionHistory,
  getSubscriptionSummary,
  listSubscriptions,
  updateSubscription,
} from './subscriptionApi.js'

vi.mock('./api.js', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }))

describe('subscription API', () => {
  beforeEach(() => {
    api.get.mockReset()
    api.post.mockReset()
    api.patch.mockReset()
  })

  it('uses the existing subscription list and summary contracts', async () => {
    api.get
      .mockResolvedValueOnce({ data: { data: [{ _id: 'sub-1' }], pagination: { page: 1, total: 1 } } })
      .mockResolvedValueOnce({ data: { data: { detectedSubscriptionCount: 1 } } })

    await expect(listSubscriptions({ status: 'detected', page: 1, limit: 20 })).resolves.toEqual({
      subscriptions: [{ _id: 'sub-1' }],
      pagination: { page: 1, total: 1 },
    })
    await expect(getSubscriptionSummary()).resolves.toEqual({ detectedSubscriptionCount: 1 })
    expect(api.get).toHaveBeenNthCalledWith(1, '/subscriptions', { params: { status: 'detected', page: 1, limit: 20 } })
    expect(api.get).toHaveBeenNthCalledWith(2, '/subscriptions/summary')
  })

  it('uses the supported detection, history and status/update endpoints', async () => {
    api.post.mockResolvedValue({ data: { data: { detectedCount: 1 } } })
    api.get.mockResolvedValue({ data: { data: [], pagination: { page: 1, total: 0 }, historyTruncated: false } })
    api.patch.mockResolvedValue({ data: { data: { _id: 'sub-1' } } })

    await expect(detectSubscriptions()).resolves.toEqual({ detectedCount: 1 })
    await expect(getSubscriptionHistory('sub-1', { page: 1, limit: 20 })).resolves.toEqual({
      payments: [],
      pagination: { page: 1, total: 0 },
      historyTruncated: false,
    })
    await updateSubscription('sub-1', { averageAmountPaise: 5000 })
    await confirmSubscription('sub-1')
    await dismissSubscription('sub-1')
    await cancelSubscription('sub-1')

    expect(api.post).toHaveBeenCalledWith('/subscriptions/detect', {})
    expect(api.get).toHaveBeenCalledWith('/subscriptions/sub-1/history', { params: { page: 1, limit: 20 } })
    expect(api.patch).toHaveBeenNthCalledWith(1, '/subscriptions/sub-1', { averageAmountPaise: 5000 })
    expect(api.patch).toHaveBeenNthCalledWith(2, '/subscriptions/sub-1/confirm')
    expect(api.patch).toHaveBeenNthCalledWith(3, '/subscriptions/sub-1/dismiss')
    expect(api.patch).toHaveBeenNthCalledWith(4, '/subscriptions/sub-1/cancel')
  })
})
