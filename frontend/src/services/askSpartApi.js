import api from './api.js'

export async function listAskSpartConversations(params = {}) {
  const response = await api.get('/ask-spart/conversations', { params })
  return { conversations: response.data.data, pagination: response.data.pagination }
}

export async function getAskSpartConversation(id) {
  const response = await api.get(`/ask-spart/conversations/${id}`)
  return response.data.data
}

export async function sendAskSpartMessage(payload) {
  const response = await api.post('/ask-spart/chat', payload)
  return response.data.data
}

export async function deleteAskSpartConversation(id) {
  const response = await api.delete(`/ask-spart/conversations/${id}`)
  return response.data.data
}

export async function getAskSpartHealth() {
  const response = await api.get('/ask-spart/health')
  return response.data.data
}
