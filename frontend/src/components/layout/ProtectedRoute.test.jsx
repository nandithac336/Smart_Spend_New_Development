import { render, screen, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/context/AuthContext.jsx'
import { queryClient } from '@/lib/queryClient.js'
import { clearTokens } from '@/services/tokenStorage.js'

vi.mock('@/services/authApi.js', () => ({
  getMe: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
}))

import ProtectedRoute from './ProtectedRoute.jsx'

describe('ProtectedRoute', () => {
  beforeEach(() => {
    clearTokens()
    queryClient.clear()
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
})
