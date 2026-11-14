import { useCallback, useEffect, useMemo, useState } from 'react'
import { AuthContext } from './authContext.js'
import { clearTokens, getAccessToken, getRefreshToken } from '@/services/tokenStorage.js'
import * as authApi from '@/services/authApi.js'
import { queryClient } from '@/lib/queryClient.js'

export function AuthProvider({ children }) {
  const [status, setStatus] = useState(
    () => getAccessToken() || getRefreshToken() ? 'loading' : 'unauthenticated',
  )
  const [user, setUser] = useState(null)

  const becomeUnauthenticated = useCallback(() => {
    clearTokens()
    queryClient.clear()
    setUser(null)
    setStatus('unauthenticated')
  }, [])

  const bootstrap = useCallback(async (isActive = () => true) => {
    if (!getAccessToken() && !getRefreshToken()) {
      return 'unauthenticated'
    }

    try {
      const data = await authApi.getMe()
      if (isActive()) {
        setUser(data.user)
        setStatus('authenticated')
      }
      return 'authenticated'
    } catch (error) {
      if (!isActive()) return 'unavailable'
      if ([401, 403].includes(error.response?.status)) {
        becomeUnauthenticated()
        return 'unauthenticated'
      }
      setStatus('unavailable')
      return 'unavailable'
    }
  }, [becomeUnauthenticated])

  useEffect(() => {
    let active = true
    const handleLogout = () => {
      if (active) becomeUnauthenticated()
    }

    window.addEventListener('auth:logout', handleLogout)
    // Startup state synchronizes with the stored session and auth API.
    // oxlint-disable-next-line react/set-state-in-effect
    bootstrap(() => active)
    return () => {
      active = false
      window.removeEventListener('auth:logout', handleLogout)
    }
  }, [bootstrap, becomeUnauthenticated])

  const establishSession = useCallback((data) => {
    setUser(data.user)
    setStatus('authenticated')
    return data.user
  }, [])

  const login = useCallback(async (credentials, options = {}) => {
    const data = await authApi.login(credentials)
    if (options.hold) {
      let committed = false
      return {
        user: data.user,
        commit() {
          if (committed) return
          committed = true
          establishSession(data)
        },
      }
    }
    return establishSession(data)
  }, [establishSession])

  const register = useCallback(async (details, options = {}) => {
    const data = await authApi.register(details)
    if (options.hold) {
      let committed = false
      return {
        user: data.user,
        commit() {
          if (committed) return
          committed = true
          establishSession(data)
        },
      }
    }
    return establishSession(data)
  }, [establishSession])

  const updateUser = useCallback(async (payload) => {
    const data = await authApi.updateMe(payload)
    setUser(data.user)
    return data.user
  }, [])

  const retryBootstrap = useCallback(async () => {
    if (!getAccessToken() && !getRefreshToken()) {
      becomeUnauthenticated()
      return 'unauthenticated'
    }
    setStatus('loading')
    return bootstrap()
  }, [bootstrap, becomeUnauthenticated])

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } catch {
      // Clear the local session even when the server cannot be reached.
    }
    becomeUnauthenticated()
  }, [becomeUnauthenticated])

  const value = useMemo(
    () => ({ status, user, login, register, logout, updateUser, retryBootstrap }),
    [status, user, login, register, logout, updateUser, retryBootstrap],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
