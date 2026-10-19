import axios from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import api from './api.js'
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from './tokenStorage.js'

const defaultAdapter = api.defaults.adapter

function unauthorized(config) {
  const error = new Error('Unauthorized')
  error.config = config
  error.response = { status: 401, data: { success: false }, config }
  return Promise.reject(error)
}

describe('API authentication interceptors', () => {
  beforeEach(() => {
    clearTokens()
    api.defaults.adapter = defaultAdapter
  })

  afterEach(() => {
    api.defaults.adapter = defaultAdapter
    vi.restoreAllMocks()
    clearTokens()
  })

  it('shares one refresh across concurrent 401s and retries using the rotated access token', async () => {
    setTokens({ accessToken: 'old-access', refreshToken: 'old-refresh' })
    const sentTokens = []
    const adapter = vi.fn(async (config) => {
      const authorization = config.headers.get('Authorization')
      sentTokens.push(authorization)
      if (authorization !== 'Bearer new-access') return unauthorized(config)
      return {
        config,
        data: { success: true, data: config.url },
        headers: {},
        status: 200,
        statusText: 'OK',
      }
    })
    api.defaults.adapter = adapter
    const refreshCall = vi.spyOn(axios, 'post').mockResolvedValue({
      data: {
        success: true,
        data: { accessToken: 'new-access', refreshToken: 'new-refresh' },
      },
    })

    const responses = await Promise.all([
      api.get('/one'),
      api.get('/two'),
      api.get('/three'),
    ])

    expect(refreshCall).toHaveBeenCalledTimes(1)
    expect(refreshCall).toHaveBeenCalledWith(
      '/api/auth/refresh',
      { refreshToken: 'old-refresh' },
      { skipAuthRefresh: true },
    )
    expect(responses.map(({ data }) => data.data)).toEqual(['/one', '/two', '/three'])
    expect(sentTokens).toHaveLength(6)
    expect(sentTokens.filter((token) => token === 'Bearer new-access')).toHaveLength(3)
    expect(getAccessToken()).toBe('new-access')
    expect(getRefreshToken()).toBe('new-refresh')
  })

  it('does not refresh a 401 from login', async () => {
    const adapter = vi.fn((config) => unauthorized(config))
    api.defaults.adapter = adapter
    const refreshCall = vi.spyOn(axios, 'post')

    await expect(
      api.post('/auth/login', { email: 'person@example.com', password: 'password' }, {
        skipAuthRefresh: true,
      }),
    ).rejects.toMatchObject({ response: { status: 401 } })

    expect(refreshCall).not.toHaveBeenCalled()
  })

  it('uses a token refreshed in another tab while waiting for the Web Lock', async () => {
    setTokens({ accessToken: 'old-access', refreshToken: 'old-refresh' })
    const originalLocks = Object.getOwnPropertyDescriptor(navigator, 'locks')
    const lockRequest = vi.fn(async (_name, callback) => {
      setTokens({ accessToken: 'new-access', refreshToken: 'new-refresh' })
      return callback()
    })
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: { request: lockRequest },
    })
    api.defaults.adapter = vi.fn(async (config) => {
      if (config.headers.get('Authorization') !== 'Bearer new-access') {
        return unauthorized(config)
      }
      return {
        config,
        data: { success: true, data: 'retried' },
        headers: {},
        status: 200,
        statusText: 'OK',
      }
    })
    const refreshCall = vi.spyOn(axios, 'post')

    try {
      const response = await api.get('/private')
      expect(response.data.data).toBe('retried')
      expect(lockRequest).toHaveBeenCalledWith(
        'smartspend-auth-token-refresh',
        expect.any(Function),
      )
      expect(refreshCall).not.toHaveBeenCalled()
    } finally {
      if (originalLocks) {
        Object.defineProperty(navigator, 'locks', originalLocks)
      } else {
        delete navigator.locks
      }
    }
  })

  it('clears stored tokens and dispatches auth:logout when refresh fails', async () => {
    setTokens({ accessToken: 'old-access', refreshToken: 'old-refresh' })
    api.defaults.adapter = vi.fn((config) => unauthorized(config))
    vi.spyOn(axios, 'post').mockRejectedValue(new Error('Refresh failed'))
    const logoutEvent = vi.fn()
    window.addEventListener('auth:logout', logoutEvent)

    try {
      await expect(api.get('/private')).rejects.toThrow('Refresh failed')
      expect(getAccessToken()).toBeNull()
      expect(getRefreshToken()).toBeNull()
      expect(logoutEvent).toHaveBeenCalledTimes(1)
    } finally {
      window.removeEventListener('auth:logout', logoutEvent)
    }
  })
})
