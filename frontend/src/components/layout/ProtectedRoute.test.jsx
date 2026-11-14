import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/context/AuthContext.jsx'
import { queryClient } from '@/lib/queryClient.js'
import { clearTokens } from '@/services/tokenStorage.js'

vi.mock('@/services/authApi.js', () => ({
  getMe: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  updateMe: vi.fn(),
}))

import ProtectedRoute from './ProtectedRoute.jsx'
import PublicOnlyRoute from './PublicOnlyRoute.jsx'
import { getMe } from '@/services/authApi.js'
import { setTokens } from '@/services/tokenStorage.js'

describe('ProtectedRoute', () => {
  beforeEach(() => {
    cleanup()
    clearTokens()
    queryClient.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('redirects unauthenticated users to login', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/dashboard']}>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<p>Login route</p>} />
              <Route element={<ProtectedRoute />}>
                <Route path="/dashboard" element={<p>Private dashboard</p>} />
              </Route>
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    )

    await waitFor(() => expect(screen.getByText('Login route')).toBeInTheDocument())
    expect(screen.queryByText('Private dashboard')).not.toBeInTheDocument()
  })

  it('shows the unavailable screen with retry and logout actions', async () => {
    setTokens({ accessToken: 'access', refreshToken: 'refresh' })
    getMe.mockRejectedValueOnce({ code: 'ERR_NETWORK' })
      .mockResolvedValueOnce({ user: { name: 'Asha' } })
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/dashboard']}>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<p>Login route</p>} />
              <Route element={<ProtectedRoute />}>
                <Route path="/dashboard" element={<p>Private dashboard</p>} />
              </Route>
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    )

    expect(await screen.findByRole('heading', { name: "Can't reach Smart Spend" })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Log out/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(screen.getByText('Private dashboard')).toBeInTheDocument())
  })

  it('shows public routes when session restoration is unavailable', async () => {
    setTokens({ accessToken: 'access', refreshToken: 'refresh' })
    getMe.mockRejectedValueOnce({ code: 'ERR_NETWORK' })
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/login']}>
          <AuthProvider>
            <Routes>
              <Route element={<PublicOnlyRoute />}>
                <Route path="/login" element={<p>Login route</p>} />
              </Route>
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    )

    expect(await screen.findByText('Login route')).toBeInTheDocument()
  })
})
