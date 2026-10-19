import api from './api.js'

export async function listTransactions(params) {
  const response = await api.get('/transactions', { params })
  return response.data
}

export async function createTransaction(payload) {
  const response = await api.post('/transactions', payload)
  return response.data
}

export async function getTransaction(id) {
  const response = await api.get(`/transactions/${id}`)
  return response.data.data
}

export async function updateTransaction(id, payload) {
  const response = await api.patch(`/transactions/${id}`, payload)
  return response.data.data
}

export async function deleteTransaction(id) {
  const response = await api.delete(`/transactions/${id}`)
  return response.data
}

export async function restoreTransaction(id) {
  const response = await api.post(`/transactions/${id}/restore`)
  return response.data.data
}

export async function listTrash() {
  const response = await api.get('/transactions/trash')
  return response.data.data
}
