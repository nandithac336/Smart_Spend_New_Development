import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Dashboard from './Dashboard.jsx'

vi.mock('@/hooks/useAuth.js', () => ({
  useAuth: () => ({ user: { name: 'Asha Rao', timezone: 'Asia/Kolkata' } }),
}))

vi.mock('@/hooks/useDashboard.js', () => ({
  useDashboard: vi.fn(),
}))

import { useDashboard } from '@/hooks/useDashboard.js'

describe('Dashboard', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    window.sessionStorage.removeItem('smart-spend-dashboard-entrance-seen')
  })

  it('renders totals from the dashboard API without counting transfers as income or spend', async () => {
    useDashboard.mockReturnValue({
      data: {
        totalBalance: 254000,
        todaySpent: 4000,
        monthSpent: 8600,
        monthIncome: 30000,
        monthNet: 21400,
        period: { timezone: 'Asia/Kolkata' },
        wallets: [{ id: 'cash', name: 'Cash', balance: 250000 }],
        topCategories: [{ categoryId: 'food', name: 'Food', icon: '🍽️', total: 8600, count: 1 }],
        monthExpenses: [],
        recent: [
          {
            id: 'transfer',
            type: 'transfer',
            transferDirection: 'in',
            amount: 50000,
            txnDate: '2026-10-19T10:00:00.000Z',
            walletId: { name: 'Cash' },
          },
          {
            id: 'expense',
            type: 'expense',
            amount: 8600,
            txnDate: '2026-10-19T09:00:00.000Z',
            categoryId: { name: 'Food', icon: '🍽️' },
            walletId: { name: 'Cash' },
          },
        ],
      },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    })

    const { container, unmount } = render(<MemoryRouter><Dashboard /></MemoryRouter>)

    expect(container.querySelector('.dashboard-entrance')).toBeInTheDocument()
    expect(window.sessionStorage.getItem('smart-spend-dashboard-entrance-seen')).toBe('true')
    expect(screen.getByRole('heading', { name: 'Good day, Asha' })).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText('₹2,540')).toBeInTheDocument()
      expect(screen.getByText('−₹40')).toBeInTheDocument()
      expect(screen.getAllByText('−₹86')).toHaveLength(3)
      expect(screen.getByText('+₹300')).toBeInTheDocument()
    }, { timeout: 2000 })
    expect(screen.getByText(/^Net in /)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Your Current Wallets' })).toBeInTheDocument()
    expect(screen.getByText('Transfer in')).toBeInTheDocument()
    expect(screen.getByLabelText('Transfer ₹500')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /View all transactions/ })).toHaveAttribute('href', '/transactions')

    unmount()
    const revisit = render(<MemoryRouter><Dashboard /></MemoryRouter>)
    expect(revisit.container.querySelector('.dashboard-entrance')).not.toBeInTheDocument()
  })

  it('shows negative total and wallet balances with their minus signs', async () => {
    useDashboard.mockReturnValue({
      data: {
        totalBalance: -4000,
        todaySpent: 0,
        monthSpent: 0,
        monthIncome: 0,
        monthNet: 0,
        period: { timezone: 'Asia/Kolkata' },
        wallets: [{ id: 'cash', name: 'Cash', balance: -4000 }],
        topCategories: [],
        monthExpenses: [],
        recent: [],
      },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    })

    render(<MemoryRouter><Dashboard /></MemoryRouter>)

    await waitFor(() => {
      expect(screen.getAllByText('-₹40').length).toBeGreaterThanOrEqual(2)
    })
  })

  it('shows the first-expense empty state and opens the quick-add flow', () => {
    useDashboard.mockReturnValue({
      data: {
        totalBalance: 0,
        todaySpent: 0,
        monthSpent: 0,
        monthIncome: 0,
        monthNet: 0,
        period: { timezone: 'Asia/Kolkata' },
        wallets: [],
        topCategories: [],
        monthExpenses: [],
        recent: [],
      },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    })
    const openQuickAdd = vi.spyOn(window, 'dispatchEvent')

    render(<MemoryRouter><Dashboard /></MemoryRouter>)

    fireEvent.click(screen.getByRole('button', { name: 'Add your first expense' }))
    expect(openQuickAdd).toHaveBeenCalledWith(expect.objectContaining({ type: 'smart-spend:open-quick-add' }))
    expect(document.querySelector('.empty-jar-illustration')).toBeInTheDocument()
  })

  it('refreshes dashboard data and shows category share based on monthly expenses', () => {
    const refetch = vi.fn()
    useDashboard.mockReturnValue({
      data: {
        totalBalance: 20000,
        todaySpent: 500,
        monthSpent: 10000,
        monthIncome: 15000,
        monthNet: 5000,
        period: { timezone: 'Asia/Kolkata', monthStart: '2026-09-30T18:30:00.000Z' },
        wallets: [],
        topCategories: [{ categoryId: 'food', name: 'Food', icon: '🍽️', total: 2500, count: 4 }],
        monthExpenses: [],
        recent: [],
      },
      isPending: false,
      isFetching: false,
      isError: false,
      refetch,
    })

    render(<MemoryRouter><Dashboard /></MemoryRouter>)

    expect(screen.getByLabelText('Dashboard date navigation')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: /Food share of .* expenses/ })).toHaveAttribute('aria-valuenow', '25')
    fireEvent.click(screen.getByRole('button', { name: 'Refresh dashboard' }))
    expect(refetch).toHaveBeenCalledOnce()
  })

  it('selects dates and navigates months without overflowing short or leap months', async () => {
    const data = {
      totalBalance: 0,
      todaySpent: 0,
      selectedDateSpent: 0,
      monthSpent: 0,
      monthIncome: 0,
      monthNet: 0,
      period: { timezone: 'Asia/Kolkata' },
      wallets: [],
      topCategories: [],
      monthExpenses: [],
      recent: [],
    }
    useDashboard.mockReturnValue({
      data,
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    })
    render(<MemoryRouter><Dashboard /></MemoryRouter>)

    fireEvent.change(screen.getByLabelText('Select dashboard date'), { target: { value: '2024-03-31' } })
    await waitFor(() => expect(useDashboard).toHaveBeenLastCalledWith('2024-03-31'))
    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }))
    await waitFor(() => expect(useDashboard).toHaveBeenLastCalledWith('2024-02-29'))
    expect(screen.getByLabelText('Dashboard date navigation')).toHaveTextContent('February 2024')
  })

  it('highlights a transaction that appears after the initial dashboard data', () => {
    const initialData = {
      totalBalance: 0,
      todaySpent: 0,
      monthSpent: 0,
      monthIncome: 0,
      monthNet: 0,
      period: { timezone: 'Asia/Kolkata' },
      wallets: [],
      topCategories: [],
      monthExpenses: [],
      recent: [],
    }
    useDashboard.mockReturnValue({
      data: initialData,
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    })
    const view = render(<MemoryRouter><Dashboard /></MemoryRouter>)

    useDashboard.mockReturnValue({
      data: {
        ...initialData,
        recent: [{
          id: 'new-expense',
          type: 'expense',
          amount: 1200,
          merchant: 'Lunch',
          txnDate: '2026-10-20T10:00:00.000Z',
          walletId: { name: 'Cash' },
        }],
        monthExpenses: [],
      },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    })
    view.rerender(<MemoryRouter><Dashboard /></MemoryRouter>)

    expect(screen.getByText('Lunch').closest('li')).toHaveClass('transaction-highlight')
  })
})
