import api from './api.js'

export async function getFinancialHealth() {
  const response = await api.get('/financial-health/score')
  return response.data.data
}
