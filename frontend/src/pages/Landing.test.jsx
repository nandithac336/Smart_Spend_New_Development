import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Landing from './Landing.jsx'

let authStatus = 'unauthenticated'

vi.mock('@/hooks/useAuth.js', () => ({
  useAuth: () => ({ status: authStatus }),
}))

vi.mock('@/hooks/useMotionDisabled.js', () => ({
  useMotionDisabled: () => true,
}))

function renderLanding() {
  return render(
    <MemoryRouter>
      <Landing />
    </MemoryRouter>,
  )
}

describe('Landing', () => {
  beforeEach(() => {
    authStatus = 'unauthenticated'
  })

  afterEach(cleanup)

  it('describes supported features without invented sample financial data', () => {
    renderLanding()

    expect(screen.getByRole('heading', { name: 'Make every rupee make sense.' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Everything in one clear place.' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'From everyday activity to a clearer picture.' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'A personal view of your finances.' })).toBeInTheDocument()
    expect(screen.getByRole('figure', { name: 'SmartSpend dashboard preview' })).toBeInTheDocument()
    expect(screen.getByText('Transactions and wallets are associated with your signed-in account.')).toBeInTheDocument()
    expect(screen.queryByText(/₹40|Category • Food|Cancel anytime|Local-first|credit card/i)).not.toBeInTheDocument()
  })

  it('links each landing navigation item to a real section', () => {
    const { container } = renderLanding()

    for (const [label, target] of [
      ['Features', '#features'],
      ['How it works', '#how'],
      ['Why SmartSpend', '#benefits'],
    ]) {
      expect(screen.getAllByRole('link', { name: label }).some((link) => link.getAttribute('href') === target)).toBe(true)
      expect(container.querySelector(target)).toBeInTheDocument()
    }
  })

  it('offers working registration and login routes to logged-out users', () => {
    renderLanding()

    expect(screen.getAllByRole('link', { name: 'Get started free' }).every((link) => link.getAttribute('href') === '/register')).toBe(true)
    expect(screen.getAllByRole('link', { name: 'Get started' }).every((link) => link.getAttribute('href') === '/register')).toBe(true)
    expect(screen.getAllByRole('link', { name: 'Log in' }).every((link) => link.getAttribute('href') === '/login')).toBe(true)
  })

  it('opens the mobile navigation and closes it after selecting a section', () => {
    renderLanding()

    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }))
    const mobileNav = screen.getByRole('navigation', { name: 'Mobile navigation' })
    expect(within(mobileNav).getByRole('link', { name: 'Features' })).toHaveAttribute('href', '#features')

    fireEvent.click(within(mobileNav).getByRole('link', { name: 'Features' }))
    expect(screen.queryByRole('navigation', { name: 'Mobile navigation' })).not.toBeInTheDocument()
  })

  it('routes authenticated calls to action to the dashboard', () => {
    authStatus = 'authenticated'
    renderLanding()

    const dashboardLinks = screen.getAllByRole('link', { name: 'Open dashboard' })
    expect(dashboardLinks.length).toBeGreaterThan(0)
    expect(dashboardLinks.every((link) => link.getAttribute('href') === '/dashboard')).toBe(true)
  })
})
