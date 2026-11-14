import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { LazyMotion, domMax } from 'motion/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Sidebar from './Sidebar.jsx'

const { logout } = vi.hoisted(() => ({ logout: vi.fn() }))

vi.mock('@/hooks/useAuth.js', () => ({
  useAuth: () => ({ logout }),
}))

vi.mock('@/hooks/useMotionDisabled.js', () => ({
  useMotionDisabled: () => false,
}))

vi.mock('@/hooks/useNotifications.js', () => ({
  useUnreadNotificationCount: () => ({ data: 3 }),
}))

vi.mock('@/hooks/useOfflineSync.js', () => ({
  useOfflineSync: () => ({ operations: [] }),
}))

vi.mock('@/components/common/ThemeToggle.jsx', () => ({
  default: () => <button type="button">Theme</button>,
}))

function renderSidebar() {
  return render(
    <LazyMotion features={domMax}>
      <MemoryRouter initialEntries={['/dashboard']}>
        <Sidebar user={{ name: 'Asha' }} />
      </MemoryRouter>
    </LazyMotion>,
  )
}

describe('Sidebar navigation', () => {
  afterEach(cleanup)

  beforeEach(() => {
    logout.mockClear()
    logout.mockResolvedValue(undefined)
  })

  it('marks the active route and preserves all navigation destinations', async () => {
    renderSidebar()

    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: /Notifications/ })).toHaveTextContent('3')
    for (const [label, href] of [
      ['Dashboard', '/dashboard'],
      ['Transactions', '/transactions'],
      ['Categorization', '/categorization'],
      ['Ask Spart', '/ask-spart'],
      ['Anomalies', '/anomalies'],
      ['Wallets', '/wallets'],
      ['Budgets', '/budgets'],
      ['Savings Goals', '/goals'],
      ['Recurring', '/recurring'],
      ['Analytics', '/analytics'],
      ['Expense Predictions', '/predictions'],
      ['Subscriptions', '/subscriptions'],
      ['Financial Health', '/financial-health'],
      ['Notifications', '/notifications'],
      ['Sync Centre', '/sync'],
      ['Settings', '/settings'],
    ]) {
      expect(screen.getByRole('link', { name: label })).toHaveAttribute('href', href)
    }
  })

  it('calls the existing logout action from the sidebar control', async () => {
    renderSidebar()

    fireEvent.click(screen.getByRole('button', { name: 'Log out' }))

    await waitFor(() => expect(logout).toHaveBeenCalledOnce())
  })
})
