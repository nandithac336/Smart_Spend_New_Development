import api from './api.js'

export async function listWallets(params) {
  const response = await api.get('/wallets', { params })
  return response.data
}

export async function createWallet(payload) {
  const response = await api.post('/wallets', payload)
  return response.data.data
}

export async function updateWallet(id, payload) {
  const response = await api.patch(`/wallets/${id}`, payload)
  return response.data.data
}

export async function archiveWallet(id) {
  const response = await api.delete(`/wallets/${id}`)
  return response.data
}

export async function transferBetweenWallets(payload) {
  const response = await api.post('/wallets/transfer', payload)
  return response.data.data
}
