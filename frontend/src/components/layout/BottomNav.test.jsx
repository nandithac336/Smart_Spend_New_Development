import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { LazyMotion, domMax } from 'motion/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import BottomNav from './BottomNav.jsx'

vi.mock('@/hooks/useMotionDisabled.js', () => ({
  useMotionDisabled: () => false,
}))

vi.mock('@/hooks/useNotifications.js', () => ({
  useUnreadNotificationCount: () => ({ data: 3 }),
}))

vi.mock('./AddButton.jsx', () => ({
  default: () => <button type="button">Add transaction</button>,
}))

afterEach(cleanup)

function renderBottomNav() {
  return render(
    <LazyMotion features={domMax}>
      <MemoryRouter initialEntries={['/dashboard']}>
        <BottomNav />
      </MemoryRouter>
    </LazyMotion>,
  )
}

describe('BottomNav', () => {
  it('keeps each route and quick-add action available with a compact transaction label', () => {
    renderBottomNav()
    const navigation = screen.getByRole('navigation', { name: 'Main navigation' })

    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/dashboard')
    expect(screen.getByRole('link', { name: 'Transactions' })).toHaveAttribute('href', '/transactions')
    expect(screen.getByRole('link', { name: 'Budgets' })).toHaveAttribute('href', '/budgets')
    expect(screen.getByRole('link', { name: 'Recurring' })).toHaveAttribute('href', '/recurring')
    expect(screen.getByRole('link', { name: 'Analytics' })).toHaveAttribute('href', '/analytics')
    expect(screen.getByRole('link', { name: 'Financial Health' })).toHaveAttribute('href', '/financial-health')
    expect(screen.getByRole('link', { name: 'Notifications' })).toHaveAttribute('href', '/notifications')
    expect(screen.getByRole('link', { name: /Notifications/ })).toHaveTextContent('3')
    expect(screen.getByRole('link', { name: 'Savings Goals' })).toHaveAttribute('href', '/goals')
    expect(screen.getByRole('link', { name: 'Wallets' })).toHaveAttribute('href', '/wallets')
    expect(screen.getByRole('link', { name: 'Subscriptions' })).toHaveAttribute('href', '/subscriptions')
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings')
    expect(screen.getByText('Activity')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add transaction' })).toBeInTheDocument()
    expect(navigation.querySelectorAll('a')).toHaveLength(11)
  })

  it('updates the active route when a navigation link is selected', () => {
    renderBottomNav()

    fireEvent.click(screen.getByRole('link', { name: 'Wallets' }))

    expect(screen.getByRole('link', { name: 'Wallets' })).toHaveAttribute('aria-current', 'page')
  })
})
