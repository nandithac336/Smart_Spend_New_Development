import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import Sync from './Sync.jsx'

const mocks = vi.hoisted(() => ({
  state: null,
  sync: vi.fn(),
  discard: vi.fn(),
}))

vi.mock('@/hooks/useAuth.js', () => ({
  useAuth: () => ({ user: { id: 'user-1', timezone: 'Asia/Kolkata' } }),
}))
vi.mock('@/hooks/useOfflineSync.js', () => ({
  useOfflineSync: () => ({ ...mocks.state, sync: mocks.sync, discard: mocks.discard }),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

function renderPage() {
  return render(<MemoryRouter><Sync /></MemoryRouter>)
}

describe('Sync Centre', () => {
  beforeEach(() => {
    mocks.state = {
      online: true,
      queue: { data: [], isPending: false, isError: false, refetch: vi.fn() },
      operations: [],
      lastSuccessfulSync: null,
      runtime: { state: 'idle' },
      serverStatus: { latestChangeAt: null, conflictedOperations: 0 },
      isSyncing: false,
      isDiscarding: false,
    }
    mocks.sync.mockReset()
    mocks.discard.mockReset()
    toast.success.mockReset()
    toast.error.mockReset()
  })

  afterEach(cleanup)

  it('shows connection, actual queue summary and server state', () => {
    mocks.state.operations = [{
      id: 'user-1:operation-1',
      status: 'pending',
      retryCount: 0,
      createdAt: '2026-11-13T10:00:00.000Z',
      operation: {
        clientOperationId: 'operation-1',
        operationType: 'create',
        entityType: 'transaction',
        payload: { type: 'expense', amount: 1250, merchant: 'Cafe' },
      },
    }]
    mocks.state.queue.data = mocks.state.operations
    renderPage()

    expect(screen.getByText('1 pending · 0 needing attention')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /create · Cafe/i })).toBeInTheDocument()
    expect(screen.getByText(/Only transaction creates, edits and deletes are queued/)).toBeInTheDocument()
  })

  it('runs real synchronization and only reports success after the service confirms it', async () => {
    mocks.sync.mockResolvedValue({ state: 'synced' })
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Sync now' }))
    await waitFor(() => expect(mocks.sync).toHaveBeenCalledWith({ force: true }))
    expect(await screen.findByText('Sync Centre')).toBeInTheDocument()
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Synchronization completed'))
  })

  it('disables manual synchronization offline and lets users explicitly discard a conflict', async () => {
    mocks.state.online = false
    mocks.state.operations = [{
      id: 'user-1:operation-2',
      status: 'conflict',
      retryCount: 0,
      createdAt: '2026-11-13T10:00:00.000Z',
      error: { code: 'stale_update', message: 'Server version changed' },
      operation: {
        clientOperationId: 'operation-2',
        operationType: 'update',
        entityType: 'transaction',
        entityId: '0123456789abcdef01234567',
        payload: { amount: 1500 },
      },
    }]
    mocks.state.queue.data = mocks.state.operations
    mocks.discard.mockResolvedValue(true)
    renderPage()

    expect(screen.getByRole('button', { name: 'Sync now' })).toBeDisabled()
    expect(screen.getByText('Server version changed')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Discard queued change' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Discard change' }))
    await waitFor(() => expect(mocks.discard).toHaveBeenCalledWith('operation-2'))
    expect(toast.success).toHaveBeenCalledWith('Queued change discarded')
  })
})
