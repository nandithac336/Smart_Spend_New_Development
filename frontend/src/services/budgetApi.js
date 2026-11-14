import api from './api.js'

export async function getBudgetsSummary() {
  const response = await api.get('/budgets/summary')
  return response.data.data
}

export async function createBudget(payload) {
  const response = await api.post('/budgets', payload)
  return response.data.data
}

export async function updateBudget(id, payload) {
  const response = await api.patch(`/budgets/${id}`, payload)
  return response.data.data
}

export async function archiveBudget(id) {
  const response = await api.delete(`/budgets/${id}`)
  return response.data.data
}
