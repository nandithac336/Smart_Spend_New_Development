import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '@/hooks/useAuth.js'
import { queryClient } from '@/lib/queryClient.js'
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from '@/services/tokenStorage.js'
import { AuthProvider } from './AuthContext.jsx'

vi.mock('@/services/authApi.js', () => ({
  getMe: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  updateMe: vi.fn(),
}))

import * as authApi from '@/services/authApi.js'

function AuthStatus() {
  const { status, user, retryBootstrap, logout, updateUser } = useAuth()
  return (
    <div>
      <p>{status}</p>
      {user && <p>{user.name}</p>}
      <button onClick={retryBootstrap} type="button">Retry bootstrap</button>
      <button onClick={logout} type="button">Log out</button>
      <button onClick={() => updateUser({ name: 'Asha Rao' })} type="button">Save profile</button>
    </div>
  )
}

function renderProvider() {
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider><AuthStatus /></AuthProvider>
    </QueryClientProvider>,
  )
}

describe('AuthProvider bootstrap and logout', () => {
  beforeEach(() => {
    cleanup()
    clearTokens()
    queryClient.clear()
    vi.clearAllMocks()
  })

  afterEach(cleanup)

  it('keeps tokens and cached queries when startup cannot reach the server, then retries successfully', async () => {
    setTokens({ accessToken: 'access', refreshToken: 'refresh' })
    queryClient.setQueryData(['cached-data'], { retained: true })
    authApi.getMe.mockRejectedValueOnce({ code: 'ERR_NETWORK' })
      .mockResolvedValueOnce({ user: { name: 'Asha' } })

    renderProvider()

    expect(await screen.findByText('unavailable')).toBeInTheDocument()
    expect(getAccessToken()).toBe('access')
    expect(getRefreshToken()).toBe('refresh')
    expect(queryClient.getQueryData(['cached-data'])).toEqual({ retained: true })

    fireEvent.click(screen.getByRole('button', { name: 'Retry bootstrap' }))
    await waitFor(() => expect(screen.getByText('authenticated')).toBeInTheDocument())
    expect(screen.getByText('Asha')).toBeInTheDocument()
  })

  it('clears tokens and becomes unauthenticated when startup returns 401', async () => {
    setTokens({ accessToken: 'access', refreshToken: 'refresh' })
    authApi.getMe.mockRejectedValue({ response: { status: 401 } })

    renderProvider()

    expect(await screen.findByText('unauthenticated')).toBeInTheDocument()
    expect(getAccessToken()).toBeNull()
    expect(getRefreshToken()).toBeNull()
  })

  it('clears local state even when the server logout request fails', async () => {
    setTokens({ accessToken: 'access', refreshToken: 'refresh' })
    authApi.getMe.mockResolvedValue({ user: { name: 'Asha' } })
    authApi.logout.mockRejectedValue(new Error('offline'))

    renderProvider()
    await screen.findByText('authenticated')
    fireEvent.click(screen.getByRole('button', { name: 'Log out' }))

    await waitFor(() => expect(screen.getByText('unauthenticated')).toBeInTheDocument())
    expect(getAccessToken()).toBeNull()
    expect(getRefreshToken()).toBeNull()
  })

  it('updates the authenticated user after a successful profile request', async () => {
    setTokens({ accessToken: 'access', refreshToken: 'refresh' })
    authApi.getMe.mockResolvedValue({ user: { name: 'Asha' } })
    authApi.updateMe.mockResolvedValue({ user: { name: 'Asha Rao', timezone: 'Asia/Kolkata' } })

    renderProvider()
    await screen.findByText('authenticated')
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }))

    expect(await screen.findByText('Asha Rao')).toBeInTheDocument()
    expect(authApi.updateMe).toHaveBeenCalledWith({ name: 'Asha Rao' })
  })
})
