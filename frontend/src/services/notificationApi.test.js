import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from './api.js'
import {
  deleteAllNotifications,
  deleteNotification,
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from './notificationApi.js'

vi.mock('./api.js', () => ({ default: { get: vi.fn(), patch: vi.fn(), delete: vi.fn() } }))

describe('notification API', () => {
  beforeEach(() => {
    api.get.mockReset()
    api.patch.mockReset()
    api.delete.mockReset()
  })

  it('uses the existing list, count and action endpoints and unwraps their response shapes', async () => {
    const listing = { success: true, data: [{ _id: 'n1' }], pagination: { page: 1, limit: 20, total: 1, pages: 1 } }
    api.get.mockResolvedValueOnce({ data: listing }).mockResolvedValueOnce({ data: { data: { count: 4 } } })
    api.patch.mockResolvedValueOnce({ data: { data: { _id: 'n1', isRead: true } } })
      .mockResolvedValueOnce({ data: { data: { modifiedCount: 3 } } })
    api.delete.mockResolvedValueOnce({ data: { data: { id: 'n1', deleted: true } } })
      .mockResolvedValueOnce({ data: { data: { deletedCount: 1 } } })

    await expect(listNotifications({ page: 1, limit: 20, isRead: false })).resolves.toEqual(listing)
    await expect(getUnreadNotificationCount()).resolves.toBe(4)
    await expect(markNotificationRead('n1')).resolves.toEqual({ _id: 'n1', isRead: true })
    await expect(markAllNotificationsRead()).resolves.toEqual({ modifiedCount: 3 })
    await expect(deleteNotification('n1')).resolves.toEqual({ id: 'n1', deleted: true })
    await expect(deleteAllNotifications()).resolves.toEqual({ deletedCount: 1 })

    expect(api.get).toHaveBeenNthCalledWith(1, '/notifications', { params: { page: 1, limit: 20, isRead: false } })
    expect(api.get).toHaveBeenNthCalledWith(2, '/notifications/unread-count')
    expect(api.patch).toHaveBeenNthCalledWith(1, '/notifications/n1/read')
    expect(api.patch).toHaveBeenNthCalledWith(2, '/notifications/read-all')
    expect(api.delete).toHaveBeenNthCalledWith(1, '/notifications/n1')
    expect(api.delete).toHaveBeenNthCalledWith(2, '/notifications')
  })
})
