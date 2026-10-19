import { createContext, useCallback, useEffect, useMemo, useState } from 'react'
import { clearTokens, getAccessToken } from '@/services/tokenStorage.js'
import * as authApi from '@/services/authApi.js'
import { queryClient } from '@/lib/queryClient.js'

export const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [status, setStatus] = useState('loading')
  const [user, setUser] = useState(null)

  const becomeUnauthenticated = useCallback(() => {
    clearTokens()
    queryClient.clear()
    setUser(null)
    setStatus('unauthenticated')
  }, [])

  useEffect(() => {
    let active = true
    const handleLogout = () => {
      if (active) becomeUnauthenticated()
    }

    window.addEventListener('auth:logout', handleLogout)

    async function bootstrap() {
      if (!getAccessToken()) {
        if (active) setStatus('unauthenticated')
        return
      }

      try {
        const data = await authApi.getMe()
        if (active) {
          setUser(data.user)
          setStatus('authenticated')
        }
      } catch {
        if (active) becomeUnauthenticated()
      }
    }

    bootstrap()
    return () => {
      active = false
      window.removeEventListener('auth:logout', handleLogout)
    }
  }, [becomeUnauthenticated])

  const establishSession = useCallback((data) => {
    setUser(data.user)
    setStatus('authenticated')
    return data.user
  }, [])

  const login = useCallback(async (credentials) => {
    const data = await authApi.login(credentials)
    return establishSession(data)
  }, [establishSession])

  const register = useCallback(async (details) => {
    const data = await authApi.register(details)
    return establishSession(data)
  }, [establishSession])

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } finally {
      becomeUnauthenticated()
    }
  }, [becomeUnauthenticated])

  const value = useMemo(
    () => ({ status, user, login, register, logout }),
    [status, user, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
