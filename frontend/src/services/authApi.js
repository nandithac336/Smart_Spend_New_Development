import api from './api.js'
import { clearTokens, setTokens } from './tokenStorage.js'

function persistSession(data) {
  setTokens({
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
  })
  return data
}

export async function register(payload) {
  const response = await api.post('/auth/register', payload, { skipAuthRefresh: true })
  return persistSession(response.data.data)
}

export async function login(payload) {
  const response = await api.post('/auth/login', payload, { skipAuthRefresh: true })
  return persistSession(response.data.data)
}

export async function refresh(refreshToken) {
  const response = await api.post(
    '/auth/refresh',
    { refreshToken },
    { skipAuthRefresh: true },
  )
  return persistSession(response.data.data)
}

export async function logout() {
  const response = await api.post('/auth/logout')
  clearTokens()
  return response.data
}

export async function getMe() {
  const response = await api.get('/auth/me')
  return response.data.data
}

export async function updateMe(payload) {
  const response = await api.patch('/auth/me', payload)
  return response.data.data
}
