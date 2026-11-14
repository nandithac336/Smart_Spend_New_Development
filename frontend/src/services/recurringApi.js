import api from './api.js'

export async function listRecurringTransactions(params) {
  const response = await api.get('/recurring', { params })
  return response.data.data
}

export async function createRecurringTransaction(payload) {
  const response = await api.post('/recurring', payload)
  return response.data.data
}

export async function updateRecurringTransaction(id, payload) {
  const response = await api.patch(`/recurring/${id}`, payload)
  return response.data.data
}

export async function pauseRecurringTransaction(id) {
  const response = await api.patch(`/recurring/${id}/pause`)
  return response.data.data
}

export async function resumeRecurringTransaction(id) {
  const response = await api.patch(`/recurring/${id}/resume`)
  return response.data.data
}

export async function cancelRecurringTransaction(id) {
  const response = await api.delete(`/recurring/${id}`)
  return response.data.data
}

export async function getRecurringHistory(id) {
  const response = await api.get(`/recurring/${id}/history`)
  return response.data.data
}
