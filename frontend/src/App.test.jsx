import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { LazyMotion, domMax } from 'motion/react'
import { createMemoryRouter, matchRoutes, RouterProvider } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { router } from './App.jsx'
import { queryClient } from './lib/queryClient.js'
import ProtectedRoute from './components/layout/ProtectedRoute.jsx'

const ROUTE_LOAD_TIMEOUT_MS = 5_000

function renderApp(path) {
  const memoryRouter = createMemoryRouter(router, { initialEntries: [path] })
  render(
    <LazyMotion features={domMax}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={memoryRouter} />
      </QueryClientProvider>
    </LazyMotion>,
  )
  return memoryRouter
}

function findRouteHeading(name) {
  return screen.findByRole('heading', { name }, { timeout: ROUTE_LOAD_TIMEOUT_MS })
}

describe('application routes', () => {
  beforeEach(() => {
    cleanup()
    queryClient.clear()
    localStorage.clear()
    window.scrollTo = vi.fn()
  })

  it('loads the landing page', async () => {
    renderApp('/')
    expect(await findRouteHeading('Make every rupee make sense.')).toBeInTheDocument()
  })

  it('loads the login page instead of the not-found page', async () => {
    renderApp('/login')
    expect(await findRouteHeading('Welcome back')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Page not found' })).not.toBeInTheDocument()
  })

  it('redirects an unauthenticated dashboard request to login', async () => {
    const memoryRouter = renderApp('/dashboard')
    await waitFor(() => expect(memoryRouter.state.location.pathname).toBe('/login'), {
      timeout: ROUTE_LOAD_TIMEOUT_MS,
    })
    expect(await findRouteHeading('Welcome back')).toBeInTheDocument()
  })

  it.each(['/budgets', '/goals', '/recurring', '/imports', '/categorization', '/ask-spart', '/anomalies', '/sync', '/settings'])('registers the protected route %s', async (path) => {
    const memoryRouter = renderApp(path)
    await waitFor(() => expect(memoryRouter.state.location.pathname).toBe('/login'), {
      timeout: ROUTE_LOAD_TIMEOUT_MS,
    })
    expect(await findRouteHeading('Welcome back')).toBeInTheDocument()
  })

  it('redirects an unauthenticated notifications request to login', async () => {
    const memoryRouter = renderApp('/notifications')
    await waitFor(() => expect(memoryRouter.state.location.pathname).toBe('/login'), {
      timeout: ROUTE_LOAD_TIMEOUT_MS,
    })
    expect(await findRouteHeading('Welcome back')).toBeInTheDocument()
  })

  it('registers analytics inside the authenticated app shell', () => {
    const matches = matchRoutes(router, '/analytics')
    expect(matches?.some(({ route }) => route.path === 'analytics')).toBe(true)
    expect(matches?.some(({ route }) => route.element?.type === ProtectedRoute)).toBe(true)
  })

  it('registers expense predictions inside the authenticated app shell', () => {
    const matches = matchRoutes(router, '/predictions')
    expect(matches?.some(({ route }) => route.path === 'predictions')).toBe(true)
    expect(matches?.some(({ route }) => route.element?.type === ProtectedRoute)).toBe(true)
  })

  it('registers subscriptions inside the authenticated app shell', () => {
    const matches = matchRoutes(router, '/subscriptions')
    expect(matches?.some(({ route }) => route.path === 'subscriptions')).toBe(true)
    expect(matches?.some(({ route }) => route.element?.type === ProtectedRoute)).toBe(true)
  })

  it('registers financial health inside the authenticated app shell', () => {
    const matches = matchRoutes(router, '/financial-health')
    expect(matches?.some(({ route }) => route.path === 'financial-health')).toBe(true)
    expect(matches?.some(({ route }) => route.element?.type === ProtectedRoute)).toBe(true)
  })

  it('registers the scanner inside the authenticated app shell', () => {
    const matches = matchRoutes(router, '/scans')
    expect(matches?.some(({ route }) => route.path === 'scans')).toBe(true)
    expect(matches?.some(({ route }) => route.element?.type === ProtectedRoute)).toBe(true)
  })

  it('shows not-found only for an unknown path', async () => {
    renderApp('/not-a-real-page')
    expect(await findRouteHeading('Page not found')).toBeInTheDocument()
  })
})
