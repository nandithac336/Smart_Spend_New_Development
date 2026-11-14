import api from './api.js'

export async function listSubscriptions(params = {}) {
  const response = await api.get('/subscriptions', { params })
  return { subscriptions: response.data.data, pagination: response.data.pagination }
}

export async function getSubscriptionSummary() {
  const response = await api.get('/subscriptions/summary')
  return response.data.data
}

export async function detectSubscriptions() {
  const response = await api.post('/subscriptions/detect', {})
  return response.data.data
}

export async function getSubscriptionHistory(id, params = {}) {
  const response = await api.get(`/subscriptions/${id}/history`, { params })
  return {
    payments: response.data.data,
    pagination: response.data.pagination,
    historyTruncated: response.data.historyTruncated,
  }
}

export async function updateSubscription(id, payload) {
  const response = await api.patch(`/subscriptions/${id}`, payload)
  return response.data.data
}

export async function confirmSubscription(id) {
  const response = await api.patch(`/subscriptions/${id}/confirm`)
  return response.data.data
}

export async function dismissSubscription(id) {
  const response = await api.patch(`/subscriptions/${id}/dismiss`)
  return response.data.data
}

export async function cancelSubscription(id) {
  const response = await api.patch(`/subscriptions/${id}/cancel`)
  return response.data.data
}
