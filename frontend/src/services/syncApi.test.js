import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from './api.js'
import { getSyncStatus, pullSyncChanges, pushSyncOperations } from './syncApi.js'

vi.mock('./api.js', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}))

describe('sync API', () => {
  beforeEach(() => {
    api.get.mockReset()
    api.post.mockReset()
  })

  it('uses the existing authenticated push, pull and status endpoints', async () => {
    api.post.mockResolvedValue({ data: { data: { results: [{ index: 0, status: 'processed' }] } } })
    api.get.mockResolvedValueOnce({ data: { data: { changes: [], pagination: { hasMore: false, nextCursor: 'cursor' } } } })
      .mockResolvedValueOnce({ data: { data: { processedOperations: 1 } } })

    await expect(pushSyncOperations([{ clientOperationId: 'operation' }])).resolves.toMatchObject({
      results: [{ status: 'processed' }],
    })
    await expect(pullSyncChanges({ cursor: 'cursor', limit: 100 })).resolves.toMatchObject({
      pagination: { hasMore: false },
    })
    await expect(getSyncStatus()).resolves.toEqual({ processedOperations: 1 })

    expect(api.post).toHaveBeenCalledWith('/sync/push', { operations: [{ clientOperationId: 'operation' }] })
    expect(api.get).toHaveBeenNthCalledWith(1, '/sync/pull', { params: { cursor: 'cursor', limit: 100 } })
    expect(api.get).toHaveBeenNthCalledWith(2, '/sync/status')
  })
})
