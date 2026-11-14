import { act, fireEvent, render, screen } from '@testing-library/react'
import { LazyMotion, domMax } from 'motion/react'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AppShell from './AppShell.jsx'

vi.mock('@/hooks/useAuth.js', () => ({
  useAuth: () => ({ user: { name: 'Asha' }, logout: vi.fn() }),
}))

vi.mock('@/hooks/useCategories.js', () => ({
  useCategories: vi.fn(() => ({ data: [] })),
}))

vi.mock('@/hooks/useWallets.js', () => ({
  useWallets: vi.fn(() => ({ data: { wallets: [] } })),
}))

vi.mock('@/hooks/useMotionDisabled.js', () => ({
  useMotionDisabled: () => false,
}))

vi.mock('@/hooks/useNotifications.js', () => ({
  useUnreadNotificationCount: () => ({ data: 0 }),
}))
vi.mock('@/hooks/useOfflineSync.js', () => ({ useOfflineSyncManager: vi.fn() }))
vi.mock('@/components/offline/OfflineStatus.jsx', () => ({
  default: () => <div>Offline status</div>,
}))

vi.mock('@/components/common/ThemeToggle.jsx', () => ({
  default: () => <button type="button">Theme</button>,
}))

vi.mock('./LogoutButton.jsx', () => ({
  default: () => <button type="button">Log out</button>,
}))

vi.mock('./AddButton.jsx', () => ({
  default: () => <button type="button">Add transaction</button>,
}))

function FirstPage() {
  const navigate = useNavigate()
  return (
    <div>
      <p>First page content</p>
      <button onClick={() => navigate('/second')} type="button">Go to second page</button>
    </div>
  )
}

describe('AppShell route transitions', () => {
  beforeEach(() => {
    window.scrollTo = vi.fn()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('keeps navigation mounted and retains outgoing page content during its exit', async () => {
    vi.useFakeTimers()
    render(
      <LazyMotion features={domMax}>
        <MemoryRouter initialEntries={['/first']}>
          <Routes>
            <Route element={<AppShell />}>
              <Route element={<FirstPage />} path="/first" />
              <Route element={<p>Second page content</p>} path="/second" />
            </Route>
          </Routes>
        </MemoryRouter>
      </LazyMotion>,
    )

    const navigation = screen.getAllByRole('navigation', { name: 'Main navigation' })[0]
    fireEvent.click(screen.getByRole('button', { name: 'Go to second page' }))

    expect(screen.getByText('First page content')).toBeInTheDocument()
    expect(screen.queryByText('Second page content')).not.toBeInTheDocument()
    expect(screen.getAllByRole('navigation', { name: 'Main navigation' })[0]).toBe(navigation)

    await act(async () => {
      vi.advanceTimersByTime(250)
    })
    expect(screen.getByText('Second page content')).toBeInTheDocument()
    expect(screen.queryByText('First page content')).not.toBeInTheDocument()
    expect(screen.getAllByRole('navigation', { name: 'Main navigation' })[0]).toBe(navigation)
  })

  it('applies the dashboard theme only on the dashboard route', () => {
    const { container, unmount } = render(
      <LazyMotion features={domMax}>
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route element={<AppShell />} path="/">
              <Route element={<p>Dashboard content</p>} path="dashboard" />
              <Route element={<p>Transactions content</p>} path="transactions" />
            </Route>
          </Routes>
        </MemoryRouter>
      </LazyMotion>,
    )

    expect(container.querySelector('.dashboard-app-shell')).toBeInTheDocument()
    unmount()
    const otherRoute = render(
      <LazyMotion features={domMax}>
        <MemoryRouter initialEntries={['/transactions']}>
          <Routes>
            <Route element={<AppShell />} path="/">
              <Route element={<p>Dashboard content</p>} path="dashboard" />
              <Route element={<p>Transactions content</p>} path="transactions" />
            </Route>
          </Routes>
        </MemoryRouter>
      </LazyMotion>,
    )
    expect(otherRoute.container.querySelector('.dashboard-app-shell')).not.toBeInTheDocument()
  })
})
