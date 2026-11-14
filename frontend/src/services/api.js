import axios from 'axios'
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from './tokenStorage.js'

const configuredApiBaseUrl = import.meta.env.VITE_API_URL?.trim()
export const API_BASE_URL = (configuredApiBaseUrl || '/api').replace(/\/+$/, '')
export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10_000,
})

const REFRESH_LOCK_NAME = 'smartspend-auth-token-refresh'
let refreshPromise

function isSessionEnding(error) {
  return !getRefreshToken() || [400, 401, 403].includes(error.response?.status)
}

function getBearerToken(config) {
  const authorization = config.headers?.Authorization ?? config.headers?.authorization
  return typeof authorization === 'string'
    ? authorization.replace(/^Bearer\s+/i, '')
    : null
}

async function requestRotatedAccessToken(failedAccessToken) {
  const refresh = async () => {
    const currentAccessToken = getAccessToken()
    if (currentAccessToken && currentAccessToken !== failedAccessToken) {
      return currentAccessToken
    }

    const refreshToken = getRefreshToken()
    if (!refreshToken) throw new Error('No refresh token is available')

    const response = await axios.post(
      `${API_BASE_URL}/auth/refresh`,
      { refreshToken },
      { skipAuthRefresh: true },
    )
    const { accessToken, refreshToken: rotatedRefreshToken } = response.data.data
    setTokens({ accessToken, refreshToken: rotatedRefreshToken })
    return accessToken
  }

  if (navigator.locks?.request) {
    return navigator.locks.request(REFRESH_LOCK_NAME, refresh)
  }
  return refresh()
}

api.interceptors.request.use((config) => {
  const accessToken = getAccessToken()
  if (accessToken) {
    config.headers = config.headers ?? {}
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    if (
      error.response?.status !== 401 ||
      error.response.data?.error?.code !== 'UNAUTHORIZED' ||
      !originalRequest ||
      originalRequest.skipAuthRefresh ||
      originalRequest._retry
    ) {
      return Promise.reject(error)
    }

    originalRequest._retry = true
    const failedAccessToken = getBearerToken(originalRequest)

    if (!refreshPromise) {
      refreshPromise = requestRotatedAccessToken(failedAccessToken).catch((refreshError) => {
        if (isSessionEnding(refreshError)) {
          clearTokens()
          window.dispatchEvent(new Event('auth:logout'))
        }
        throw refreshError
      }).finally(() => {
        refreshPromise = undefined
      })
    }

    try {
      const accessToken = await refreshPromise
      originalRequest.headers = originalRequest.headers ?? {}
      originalRequest.headers.Authorization = `Bearer ${accessToken}`
      return api(originalRequest)
    } catch (refreshError) {
      return Promise.reject(refreshError)
    }
  },
)

export default api
