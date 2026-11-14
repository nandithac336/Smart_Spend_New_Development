import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/context/AuthContext.jsx'
import { queryClient } from '@/lib/queryClient.js'
import { clearTokens } from '@/services/tokenStorage.js'
import PublicOnlyRoute from '@/components/layout/PublicOnlyRoute.jsx'
import Login from './Login.jsx'

vi.mock('@/services/authApi.js', () => ({
  getMe: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  updateMe: vi.fn(),
}))

vi.mock('@/hooks/useMotionDisabled.js', () => ({
  useMotionDisabled: () => false,
}))

import { login } from '@/services/authApi.js'

describe('Login', () => {
  beforeEach(() => {
    cleanup()
    clearTokens()
    queryClient.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
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
            <Routes>
              <Route path="/login" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
              <Route path="/dashboard" element={<p>Dashboard destination</p>} />
            </Routes>
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
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
    expect(screen.queryByText('Dashboard destination')).not.toBeInTheDocument()
  })

  it('does not call the API for invalid email or a missing password', async () => {
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

    await user.type(screen.getByLabelText('Email'), 'invalid-email')
    await user.click(screen.getByRole('button', { name: 'Log in' }))

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument()
    expect(screen.getByText('Password is required')).toBeInTheDocument()
    expect(login).not.toHaveBeenCalled()
  })

  it('shows a useful message when the login API is unreachable', async () => {
    login.mockRejectedValue({ code: 'ERR_NETWORK' })
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

    expect(await screen.findByRole('alert')).toHaveTextContent("Can't reach the server. Is the backend running?")
  })

  it('toggles password visibility and navigates to registration', async () => {
    const user = userEvent.setup()

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/login']}>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<p>Registration destination</p>} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    )

    const password = screen.getByLabelText('Password')
    expect(password).toHaveAttribute('type', 'password')
    await user.click(screen.getByRole('button', { name: 'Show password' }))
    expect(password).toHaveAttribute('type', 'text')
    await user.click(screen.getByRole('button', { name: 'Hide password' }))
    expect(password).toHaveAttribute('type', 'password')

    await user.click(screen.getByRole('link', { name: 'Create an account' }))
    expect(screen.getByText('Registration destination')).toBeInTheDocument()
  })

  it('shows Signed in before committing and redirects to the saved destination afterward', async () => {
    login.mockResolvedValue({ user: { name: 'Alex' } })
    const user = userEvent.setup()

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[{
          pathname: '/login',
          state: { from: { pathname: '/transactions', search: '?q=rent', hash: '#recent' } },
        }]}>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
              <Route path="/transactions" element={<p>Transactions destination</p>} />
              <Route path="/dashboard" element={<p>Dashboard destination</p>} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    )

    await user.type(screen.getByLabelText('Email'), 'person@example.com')
    await user.type(screen.getByLabelText('Password'), 'correct-password')
    vi.useFakeTimers()
    await act(async () => {
      fireEvent.submit(screen.getByRole('button', { name: 'Log in' }).closest('form'))
      await Promise.resolve()
      await Promise.resolve()
    })

    const signedInLabel = screen.getByText('Signed in')
    expect(signedInLabel).toBeInTheDocument()
    expect(signedInLabel.closest('button').querySelector('.lucide-check')).toBeInTheDocument()
    expect(screen.queryByText('Transactions destination')).not.toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(449)
      await Promise.resolve()
    })
    expect(screen.getByText('Signed in')).toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(1)
      await Promise.resolve()
    })
    expect(screen.getByText('Transactions destination')).toBeInTheDocument()
  })
})
