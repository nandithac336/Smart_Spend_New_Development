import api from './api.js'

export async function listCategorySuggestions(params = {}) {
  const response = await api.get('/categorization/suggestions', { params })
  return { suggestions: response.data.data, pagination: response.data.pagination }
}

export async function acceptCategorySuggestion(id, categoryId) {
  const response = await api.post(`/categorization/${id}/accept`, categoryId ? { categoryId } : {})
  return response.data
}

export async function rejectCategorySuggestion(id) {
  const response = await api.post(`/categorization/${id}/reject`, {})
  return response.data
}
