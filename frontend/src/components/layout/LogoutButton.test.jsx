import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import LogoutButton from './LogoutButton.jsx'

const mocks = vi.hoisted(() => ({
  logout: vi.fn(),
  operations: [],
}))

vi.mock('@/hooks/useAuth.js', () => ({
  useAuth: () => ({ logout: mocks.logout, user: { id: 'user-1' } }),
}))
vi.mock('@/hooks/useOfflineSync.js', () => ({
  useOfflineSync: () => ({ operations: mocks.operations }),
}))

describe('LogoutButton with pending offline changes', () => {
  afterEach(() => {
    cleanup()
    mocks.logout.mockReset()
    mocks.operations = []
  })

  it('confirms that queued operations will remain scoped to the current account', async () => {
    mocks.operations = [{ status: 'pending' }, { status: 'conflict' }]
    mocks.logout.mockResolvedValue(undefined)
    render(<LogoutButton />)

    fireEvent.click(screen.getByRole('button', { name: 'Log out' }))
    expect(await screen.findByText(/2 queued transaction changes will remain saved for this account/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Log out and keep changes' }))
    await waitFor(() => expect(mocks.logout).toHaveBeenCalledOnce())
  })

  it('logs out directly when no operations are pending', async () => {
    mocks.logout.mockResolvedValue(undefined)
    render(<LogoutButton />)

    fireEvent.click(screen.getByRole('button', { name: 'Log out' }))
    await waitFor(() => expect(mocks.logout).toHaveBeenCalledOnce())
    expect(screen.queryByText('Keep pending changes on this device?')).not.toBeInTheDocument()
  })
})
