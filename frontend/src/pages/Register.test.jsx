import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/context/AuthContext.jsx'
import { queryClient } from '@/lib/queryClient.js'
import { clearTokens } from '@/services/tokenStorage.js'
import PublicOnlyRoute from '@/components/layout/PublicOnlyRoute.jsx'
import Register from './Register.jsx'

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

import { register } from '@/services/authApi.js'

describe('Register', () => {
  beforeEach(() => {
    cleanup()
    clearTokens()
    queryClient.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('validates password length and letter/number requirements', async () => {
    const user = userEvent.setup()

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/register']}>
          <AuthProvider>
            <Routes><Route path="/register" element={<Register />} /></Routes>
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    )

    await user.type(screen.getByLabelText('Name'), 'Alex Example')
    await user.type(screen.getByLabelText('Email'), 'alex@example.com')
    await user.type(screen.getByLabelText('Password'), 'abcdefgh')
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    expect(await screen.findByText('Password must contain a letter and a number')).toBeInTheDocument()
    expect(register).not.toHaveBeenCalled()
  })

  it('toggles password visibility and navigates to login', async () => {
    const user = userEvent.setup()

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/register']}>
          <AuthProvider>
            <Routes>
              <Route path="/register" element={<Register />} />
              <Route path="/login" element={<p>Login destination</p>} />
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

    await user.click(screen.getByRole('link', { name: 'Log in' }))
    expect(screen.getByText('Login destination')).toBeInTheDocument()
  })

  it('submits once from step two and returns to email after a duplicate-email response', async () => {
    register.mockRejectedValue({
      response: {
        status: 409,
        data: { error: { message: 'Email already exists' } },
      },
    })
    const user = userEvent.setup()

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/register']}>
          <AuthProvider>
            <Routes><Route path="/register" element={<Register />} /></Routes>
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    )

    await user.type(screen.getByLabelText('Name'), 'Alex Example')
    await user.type(screen.getByLabelText('Email'), 'alex@example.com')
    await user.type(screen.getByLabelText('Password'), 'strongpass123')
    const continueButton = screen.getByRole('button', { name: 'Continue' })
    expect(continueButton).toHaveClass('auth-submit')
    expect(continueButton.querySelector('.lucide-arrow-right')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await user.click(await screen.findByRole('button', { name: 'Create account' }))

    await waitFor(() => expect(register).toHaveBeenCalledTimes(1))
    expect(register).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Alex Example',
      email: 'alex@example.com',
      password: 'strongpass123',
      userType: 'other',
    }))
    expect(await screen.findByText('Email already exists')).toBeInTheDocument()
    expect(screen.getByText('Step 1 of 2')).toBeInTheDocument()
  })

  it('shows Account created before committing and redirects after the success delay', async () => {
    register.mockResolvedValue({ user: { name: 'Alex Example' } })
    const user = userEvent.setup()

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/register']}>
          <AuthProvider>
            <Routes>
              <Route path="/register" element={<PublicOnlyRoute><Register /></PublicOnlyRoute>} />
              <Route path="/dashboard" element={<p>Dashboard destination</p>} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    )

    await user.type(screen.getByLabelText('Name'), 'Alex Example')
    await user.type(screen.getByLabelText('Email'), 'alex@example.com')
    await user.type(screen.getByLabelText('Password'), 'strongpass123')
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await screen.findByRole('button', { name: 'Create account' })
    vi.useFakeTimers()
    await act(async () => {
      fireEvent.submit(screen.getByRole('button', { name: 'Create account' }).closest('form'))
      await Promise.resolve()
      await Promise.resolve()
    })

    const accountCreatedLabel = screen.getByText('Account created')
    expect(accountCreatedLabel).toBeInTheDocument()
    expect(accountCreatedLabel.closest('button').querySelector('.lucide-check')).toBeInTheDocument()
    expect(screen.queryByText('Dashboard destination')).not.toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(449)
      await Promise.resolve()
    })
    expect(screen.getByText('Account created')).toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(1)
      await Promise.resolve()
    })
    expect(screen.getByText('Dashboard destination')).toBeInTheDocument()
  })
})
