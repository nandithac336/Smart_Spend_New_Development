import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Notifications from './Notifications.jsx'
import {
  deleteAllNotifications,
  deleteNotification,
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/services/notificationApi.js'
import { toast } from 'sonner'

vi.mock('@/services/notificationApi.js', () => ({
  deleteAllNotifications: vi.fn(),
  deleteNotification: vi.fn(),
  getUnreadNotificationCount: vi.fn(),
  listNotifications: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  markNotificationRead: vi.fn(),
}))

vi.mock('@/hooks/useAuth.js', () => ({
  useAuth: () => ({ user: { timezone: 'Asia/Kolkata' } }),
}))

vi.mock('@/hooks/useLowPower.js', () => ({
  useLowPower: () => ({ lowPower: false }),
}))

vi.mock('@/hooks/useMotionDisabled.js', () => ({
  useMotionDisabled: () => false,
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const budgetNotification = {
  _id: 'notification-budget',
  type: 'budget_approaching',
  title: 'Budget approaching its limit',
  message: 'Dining has reached 85% of its limit.',
  severity: 'warning',
  isRead: false,
  createdAt: '2026-11-12T08:30:00.000Z',
}

const anomalyNotification = {
  _id: 'notification-anomaly',
  type: 'anomaly_detected',
  title: 'High-severity spending anomaly',
  message: 'Unusually large transaction.',
  severity: 'critical',
  isRead: true,
  createdAt: '2026-11-11T08:30:00.000Z',
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Notifications />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Notifications centre', () => {
  beforeEach(() => {
    listNotifications.mockReset().mockImplementation(async ({ page = 1 } = {}) => ({
      success: true,
      data: [budgetNotification, anomalyNotification],
      pagination: { page, limit: 20, total: 21, pages: 2 },
    }))
    getUnreadNotificationCount.mockReset().mockResolvedValue(1)
    markNotificationRead.mockReset().mockResolvedValue({ ...budgetNotification, isRead: true })
    markAllNotificationsRead.mockReset().mockResolvedValue({ modifiedCount: 1 })
    deleteNotification.mockReset().mockResolvedValue({ id: budgetNotification._id, deleted: true })
    deleteAllNotifications.mockReset().mockResolvedValue({ deletedCount: 2 })
    toast.success.mockReset()
    toast.error.mockReset()
  })

  afterEach(cleanup)

  it('renders notification content, severity, relative timestamp, route and unread count', async () => {
    renderPage()

    await waitFor(() => expect(listNotifications).toHaveBeenCalled())
    expect(await screen.findByRole('heading', { name: 'Budget approaching its limit' })).toBeInTheDocument()
    expect(screen.getByText('Dining has reached 85% of its limit.')).toBeInTheDocument()
    expect(screen.getByRole('article', { name: 'Unread notification: Budget approaching its limit' })).toHaveTextContent('warning')
    const budgetCard = screen.getByRole('article', { name: 'Unread notification: Budget approaching its limit' })
    expect(within(budgetCard).getByRole('link', { name: 'View details' })).toHaveAttribute('href', '/budgets')
    expect(screen.getByText(/1 unread/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'High-severity spending anomaly' })).toBeInTheDocument()
    expect(screen.getByRole('article', { name: 'Unread notification: Budget approaching its limit' })).toBeInTheDocument()
    expect(screen.getByText(/Live push delivery and notification preferences are not available/)).toBeInTheDocument()
  })

  it('filters using only supported backend query parameters and resets the page', async () => {
    renderPage()
    await screen.findByRole('heading', { name: 'Budget approaching its limit' })

    fireEvent.change(screen.getByLabelText('Read status'), { target: { value: 'unread' } })
    await waitFor(() => expect(listNotifications).toHaveBeenLastCalledWith({
      isRead: false,
      page: 1,
      limit: 20,
    }))

    fireEvent.change(screen.getByLabelText('Notification type'), { target: { value: 'anomaly_detected' } })
    await waitFor(() => expect(listNotifications).toHaveBeenLastCalledWith({
      isRead: false,
      type: 'anomaly_detected',
      page: 1,
      limit: 20,
    }))

    fireEvent.change(screen.getByLabelText('Severity'), { target: { value: 'critical' } })
    await waitFor(() => expect(listNotifications).toHaveBeenLastCalledWith({
      isRead: false,
      type: 'anomaly_detected',
      severity: 'critical',
      page: 1,
      limit: 20,
    }))
  })

  it('paginates through the backend response', async () => {
    renderPage()
    await screen.findByRole('heading', { name: 'Budget approaching its limit' })
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))

    await waitFor(() => expect(listNotifications).toHaveBeenLastCalledWith({ page: 2, limit: 20 }))
    expect(await screen.findByText('Page 2 of 2')).toBeInTheDocument()
  })

  it('marks individual notifications and all notifications as read', async () => {
    renderPage()
    await screen.findByRole('heading', { name: 'Budget approaching its limit' })
    fireEvent.click(screen.getByRole('button', { name: 'Mark Budget approaching its limit as read' }))

    await waitFor(() => expect(markNotificationRead.mock.calls[0]?.[0]).toBe('notification-budget'))
    expect(toast.success).toHaveBeenCalledWith('Notification marked as read')

    fireEvent.click(screen.getByRole('button', { name: 'Mark all read' }))
    await waitFor(() => expect(markAllNotificationsRead).toHaveBeenCalledOnce())
    expect(toast.success).toHaveBeenCalledWith('1 notification marked as read')
  })

  it('deletes one notification and confirms clear-all before deleting the entire inbox', async () => {
    renderPage()
    await screen.findByRole('heading', { name: 'Budget approaching its limit' })
    fireEvent.click(screen.getByRole('button', { name: 'Delete Budget approaching its limit' }))
    await waitFor(() => expect(deleteNotification.mock.calls[0]?.[0]).toBe('notification-budget'))

    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }))
    expect(await screen.findByRole('heading', { name: 'Delete all notifications?' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Delete all' }))
    await waitFor(() => expect(deleteAllNotifications).toHaveBeenCalledOnce())
    expect(toast.success).toHaveBeenCalledWith('2 notifications deleted')
  })

  it('shows loading, filtered empty and retryable list error states', async () => {
    listNotifications.mockImplementationOnce(() => new Promise(() => {}))
    renderPage()
    expect(screen.getByLabelText('Loading notifications')).toHaveAttribute('aria-busy', 'true')
    cleanup()

    listNotifications.mockResolvedValue({
      success: true,
      data: [],
      pagination: { page: 1, limit: 20, total: 0, pages: 0 },
    })
    renderPage()
    expect(await screen.findByRole('heading', { name: 'You’re all caught up' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Read status'), { target: { value: 'read' } })
    expect(await screen.findByRole('heading', { name: 'No matching notifications' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))

    cleanup()
    listNotifications.mockReset().mockRejectedValueOnce(new Error('offline'))
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Couldn’t load notifications' })).toBeInTheDocument()
    listNotifications.mockResolvedValueOnce({
      success: true,
      data: [budgetNotification],
      pagination: { page: 1, limit: 20, total: 1, pages: 1 },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('heading', { name: 'Budget approaching its limit' })).toBeInTheDocument()
  })

  it('refreshes list and unread count through existing endpoints', async () => {
    renderPage()
    await screen.findByRole('heading', { name: 'Budget approaching its limit' })
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))

    await waitFor(() => {
      expect(listNotifications).toHaveBeenCalledTimes(2)
      expect(getUnreadNotificationCount).toHaveBeenCalledTimes(2)
    })
    expect(toast.success).toHaveBeenCalledWith('Notifications refreshed')
  })

  it('does not render a fabricated notification for missing backend data', async () => {
    listNotifications.mockResolvedValueOnce({
      success: true,
      data: [],
      pagination: { page: 1, limit: 20, total: 0, pages: 0 },
    })
    renderPage()
    expect(await screen.findByRole('heading', { name: 'You’re all caught up' })).toBeInTheDocument()
    expect(screen.queryByText('No notifications yet')).not.toBeInTheDocument()
  })
})
