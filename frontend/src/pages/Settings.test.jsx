import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import userEvent from '@testing-library/user-event'
import { LazyMotion, domMax } from 'motion/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Settings from './Settings.jsx'

const mocks = vi.hoisted(() => ({
  user: null,
  updateUser: vi.fn(),
}))

vi.mock('@/hooks/useAuth.js', () => ({
  useAuth: () => ({ user: mocks.user, updateUser: mocks.updateUser }),
}))

vi.mock('@/components/layout/LogoutButton.jsx', () => ({
  default: () => <button type="button">Log out</button>,
}))

function renderSettings(queryClient = new QueryClient()) {
  return render(
    <QueryClientProvider client={queryClient}>
      <LazyMotion features={domMax}>
        <MemoryRouter><Settings /></MemoryRouter>
      </LazyMotion>
    </QueryClientProvider>,
  )
}

describe('settings centre', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark', 'light')
    mocks.user = {
      id: 'user-1',
      name: 'Asha Rao',
      email: 'asha@example.com',
      phone: '9876543210',
      userType: 'student',
      timezone: 'Asia/Kolkata',
      createdAt: '2024-01-02T10:00:00.000Z',
    }
    mocks.updateUser.mockReset()
  })

  afterEach(cleanup)

  it('updates only supported profile fields and reflects the saved server user', async () => {
    const user = userEvent.setup()
    const queryClient = new QueryClient()
    queryClient.setQueryData(['cached-user-data'], { stale: false })
    mocks.updateUser.mockResolvedValue({
      ...mocks.user,
      name: 'Asha Singh',
      timezone: 'America/New_York',
    })
    renderSettings(queryClient)

    await user.clear(screen.getByLabelText('Full name'))
    await user.type(screen.getByLabelText('Full name'), 'Asha Singh')
    await user.selectOptions(screen.getByLabelText('Timezone'), 'America/New_York')
    await user.click(screen.getByRole('button', { name: 'Save profile' }))

    await waitFor(() => expect(mocks.updateUser).toHaveBeenCalledWith({
      name: 'Asha Singh',
      phone: '9876543210',
      userType: 'student',
      timezone: 'America/New_York',
    }))
    expect(await screen.findByText('Profile updated successfully.')).toBeInTheDocument()
    expect(queryClient.getQueryState(['cached-user-data'])?.isInvalidated).toBe(true)
  })

  it('validates profile fields before sending an update', async () => {
    const user = userEvent.setup()
    renderSettings()

    await user.clear(screen.getByLabelText('Full name'))
    await user.type(screen.getByLabelText('Full name'), 'A')
    await user.clear(screen.getByLabelText('Phone number'))
    await user.type(screen.getByLabelText('Phone number'), '123')
    await user.click(screen.getByRole('button', { name: 'Save profile' }))

    expect(await screen.findByText('Use at least 2 characters.')).toBeInTheDocument()
    expect(screen.getByText('Enter a valid 10-digit Indian mobile number.')).toBeInTheDocument()
    expect(mocks.updateUser).not.toHaveBeenCalled()
  })

  it('shows backend field errors and keeps the form available for retry', async () => {
    const user = userEvent.setup()
    mocks.updateUser.mockRejectedValue({
      response: {
        status: 400,
        data: {
          error: {
            message: 'Profile update failed',
            details: [{ field: 'name', message: 'This name cannot be used.' }],
          },
        },
      },
    })
    renderSettings()

    await user.clear(screen.getByLabelText('Full name'))
    await user.type(screen.getByLabelText('Full name'), 'Asha Singh')
    await user.click(screen.getByRole('button', { name: 'Save profile' }))

    expect(await screen.findByText('This name cannot be used.')).toBeInTheDocument()
    expect(screen.getByText('Profile update failed')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save profile' })).toBeEnabled()
  })

  it('does not pretend a saved phone number can be removed', async () => {
    const user = userEvent.setup()
    renderSettings()

    await user.clear(screen.getByLabelText('Phone number'))
    await user.click(screen.getByRole('button', { name: 'Save profile' }))

    expect(await screen.findByText('The current account API does not support removing a saved phone number.')).toBeInTheDocument()
    expect(mocks.updateUser).not.toHaveBeenCalled()
  })

  it('persists appearance preferences locally and explains unsupported settings', async () => {
    const user = userEvent.setup()
    renderSettings()

    await user.click(screen.getByRole('button', { name: 'Dark' }))
    await user.click(screen.getByRole('radio', { name: /Reduced/ }))

    expect(localStorage.getItem('smart-spend-theme')).toBe('dark')
    expect(localStorage.getItem('smart-spend-effects')).toBe('reduced')
    expect(screen.getByText(/Currency is not configurable/)).toBeInTheDocument()
    expect(screen.getByText(/not connected to app behavior/)).toBeInTheDocument()
  })

  it('shows available account security facts without unsupported password or deletion actions', () => {
    renderSettings()

    expect(screen.getByText(/2 January 2024/)).toBeInTheDocument()
    expect(screen.getByText('Not provided by the account API')).toBeInTheDocument()
    expect(screen.getByText(/Password changes and session lists are not supported/)).toBeInTheDocument()
    expect(screen.getByText(/Account deletion is not supported/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Current password')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Delete account/i })).not.toBeInTheDocument()
  })
})
