import api from './api.js'

export async function listNotifications(params) {
  const response = await api.get('/notifications', { params })
  return response.data
}

export async function getUnreadNotificationCount() {
  const response = await api.get('/notifications/unread-count')
  return response.data.data.count
}

export async function markNotificationRead(id) {
  const response = await api.patch(`/notifications/${id}/read`)
  return response.data.data
}

export async function markAllNotificationsRead() {
  const response = await api.patch('/notifications/read-all')
  return response.data.data
}

export async function deleteNotification(id) {
  const response = await api.delete(`/notifications/${id}`)
  return response.data.data
}

export async function deleteAllNotifications() {
  const response = await api.delete('/notifications')
  return response.data.data
}
