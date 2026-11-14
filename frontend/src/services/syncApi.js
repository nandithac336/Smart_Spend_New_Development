import api from './api.js'

export async function pushSyncOperations(operations) {
  const response = await api.post('/sync/push', { operations })
  return response.data.data
}

export async function pullSyncChanges(params) {
  const response = await api.get('/sync/pull', { params })
  return response.data.data
}

export async function getSyncStatus() {
  const response = await api.get('/sync/status')
  return response.data.data
}
