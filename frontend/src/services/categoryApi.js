import api from './api.js'

export async function listCategories(params) {
  const response = await api.get('/categories', { params })
  return response.data.data
}

export async function createCategory(payload) {
  const response = await api.post('/categories', payload)
  return response.data.data
}

export async function deleteCategory(id) {
  const response = await api.delete(`/categories/${id}`)
  return response.data
}
