import api from './api.js'

export async function listAnomalies(params = {}) {
  const response = await api.get('/anomalies', { params })
  return { anomalies: response.data.data, pagination: response.data.pagination }
}

export async function getAnomalySummary() {
  const response = await api.get('/anomalies/summary')
  return response.data.data
}

export async function detectAnomalies(params = {}) {
  const response = await api.post('/anomalies/detect', params)
  return response.data.data
}

export async function updateAnomalyStatus(id, status) {
  const response = await api.patch(`/anomalies/${id}/status`, { status })
  return response.data.data
}
