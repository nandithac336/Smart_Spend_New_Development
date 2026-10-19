import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/context/AuthContext.jsx'
import { queryClient } from '@/lib/queryClient.js'
import { clearTokens } from '@/services/tokenStorage.js'
import Login from './Login.jsx'

vi.mock('@/services/authApi.js', () => ({
  getMe: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
}))

import { login } from '@/services/authApi.js'

describe('Login', () => {
  beforeEach(() => {
    clearTokens()
    queryClient.clear()
    vi.clearAllMocks()
  })

  it('shows API field validation errors below the matching input', async () => {
    login.mockRejectedValue({
      response: {
        status: 400,
        data: {
          error: {
            message: 'Validation failed',
            details: [{ field: 'email', message: 'Email is not recognized' }],
          },
        },
      },
    })
    const user = userEvent.setup()

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/login']}>
          <AuthProvider>
            <Routes><Route path="/login" element={<Login />} /></Routes>
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    )

    await user.type(screen.getByLabelText('Email'), 'person@example.com')
    await user.type(screen.getByLabelText('Password'), 'wrong-password')
    await user.click(screen.getByRole('button', { name: 'Log in' }))

    await waitFor(() => expect(screen.getByText('Email is not recognized')).toBeInTheDocument())
    expect(login).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alert', { name: 'Validation failed' })).not.toBeInTheDocument()
  })
})
