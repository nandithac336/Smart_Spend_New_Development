const ACCESS_TOKEN_KEY = 'smartspend.accessToken'
const REFRESH_TOKEN_KEY = 'smartspend.refreshToken'

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY)
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

export function setTokens({ accessToken, refreshToken }) {
  if (typeof accessToken !== 'string' || typeof refreshToken !== 'string') {
    throw new TypeError('Both access and refresh tokens must be strings')
  }

  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}
