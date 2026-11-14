import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from './api.js'
import {
  cancelRecurringTransaction,
  createRecurringTransaction,
  getRecurringHistory,
  listRecurringTransactions,
  pauseRecurringTransaction,
  resumeRecurringTransaction,
  updateRecurringTransaction,
} from './recurringApi.js'

vi.mock('./api.js', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

describe('recurring transaction API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.get.mockResolvedValue({ data: { data: [] } })
    api.post.mockResolvedValue({ data: { data: { id: 'schedule-1' } } })
    api.patch.mockResolvedValue({ data: { data: { id: 'schedule-1' } } })
    api.delete.mockResolvedValue({ data: { data: { id: 'schedule-1', status: 'cancelled' } } })
  })

  it('uses the existing list, CRUD, pause/resume, cancel and history endpoints', async () => {
    await listRecurringTransactions({ status: 'active' })
    await createRecurringTransaction({ name: 'Rent' })
    await updateRecurringTransaction('schedule-1', { amount: 200 })
    await pauseRecurringTransaction('schedule-1')
    await resumeRecurringTransaction('schedule-1')
    await cancelRecurringTransaction('schedule-1')
    await getRecurringHistory('schedule-1')

    expect(api.get).toHaveBeenNthCalledWith(1, '/recurring', { params: { status: 'active' } })
    expect(api.post).toHaveBeenCalledWith('/recurring', { name: 'Rent' })
    expect(api.patch).toHaveBeenNthCalledWith(1, '/recurring/schedule-1', { amount: 200 })
    expect(api.patch).toHaveBeenNthCalledWith(2, '/recurring/schedule-1/pause')
    expect(api.patch).toHaveBeenNthCalledWith(3, '/recurring/schedule-1/resume')
    expect(api.delete).toHaveBeenCalledWith('/recurring/schedule-1')
    expect(api.get).toHaveBeenNthCalledWith(2, '/recurring/schedule-1/history')
  })
})
