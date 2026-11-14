import api from './api.js'

export async function getGoalsSummary() {
  const response = await api.get('/goals/summary')
  return response.data.data
}

export async function createGoal(payload) {
  const response = await api.post('/goals', payload)
  return response.data.data
}

export async function updateGoal(id, payload) {
  const response = await api.patch(`/goals/${id}`, payload)
  return response.data.data
}

export async function addGoalContribution(id, payload) {
  const response = await api.post(`/goals/${id}/contributions`, payload)
  return response.data.data
}

export async function archiveGoal(id) {
  const response = await api.delete(`/goals/${id}`)
  return response.data.data
}

export async function pauseGoal(id) {
  const response = await api.patch(`/goals/${id}/pause`)
  return response.data.data
}

export async function resumeGoal(id) {
  const response = await api.patch(`/goals/${id}/resume`)
  return response.data.data
}
