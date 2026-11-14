import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import OfflineStatus from './OfflineStatus.jsx'

const mocks = vi.hoisted(() => ({ value: null }))

vi.mock('@/hooks/useAuth.js', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }))
vi.mock('@/hooks/useOfflineSync.js', () => ({ useOfflineSync: () => mocks.value }))

function renderStatus() {
  return render(<MemoryRouter><OfflineStatus /></MemoryRouter>)
}

describe('global offline status', () => {
  afterEach(cleanup)

  it('shows offline state and the actual pending count with a Sync Centre link', () => {
    mocks.value = {
      online: false,
      runtime: { state: 'offline' },
      operations: [{ status: 'pending' }, { status: 'pending' }],
      queue: { isError: false },
      isSyncing: false,
    }
    renderStatus()

    expect(screen.getByRole('link', { name: 'Synchronization status: Offline' })).toHaveAttribute('href', '/sync')
    expect(screen.getByText('Offline')).toBeInTheDocument()
  })

  it('distinguishes browser connectivity from backend availability', () => {
    mocks.value = {
      online: true,
      runtime: { state: 'unavailable' },
      operations: [],
      queue: { isError: false },
      isSyncing: false,
    }
    renderStatus()

    expect(screen.getByText('Server unavailable')).toBeInTheDocument()
  })

  it('surfaces queued conflicts that need user attention', () => {
    mocks.value = {
      online: true,
      runtime: { state: 'attention' },
      operations: [{ status: 'conflict' }],
      queue: { isError: false },
      isSyncing: false,
    }
    renderStatus()

    expect(screen.getByRole('link', { name: 'Synchronization status: Sync needs attention' })).toHaveAttribute('href', '/sync')
  })
})
