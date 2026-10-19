import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/context/AuthContext.jsx'
import { queryClient } from '@/lib/queryClient.js'
import { clearTokens } from '@/services/tokenStorage.js'
import Register from './Register.jsx'

vi.mock('@/services/authApi.js', () => ({
  getMe: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
}))

import { register } from '@/services/authApi.js'

describe('Register', () => {
  beforeEach(() => {
    clearTokens()
    queryClient.clear()
    vi.clearAllMocks()
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
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByText('Password must contain a letter and a number')).toBeInTheDocument()
    expect(register).not.toHaveBeenCalled()
  })
})
