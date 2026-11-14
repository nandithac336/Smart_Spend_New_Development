import api from './api.js'

export async function getDashboard(date) {
  const response = await api.get('/dashboard', { params: date ? { date } : undefined })
  return response.data.data
}
