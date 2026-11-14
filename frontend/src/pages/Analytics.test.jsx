import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Analytics from './Analytics.jsx'
import { downloadAnalyticsExport, getAnalyticsDashboard, saveAnalyticsExport } from '@/services/analyticsApi.js'
import { toast } from 'sonner'

vi.mock('@/hooks/useAuth.js', () => ({
  useAuth: () => ({ user: { timezone: 'Asia/Kolkata' } }),
}))

vi.mock('@/services/analyticsApi.js', () => ({
  getAnalyticsDashboard: vi.fn(),
  downloadAnalyticsExport: vi.fn(),
  saveAnalyticsExport: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('recharts', () => {
  const passThrough = ({ children }) => children ?? null
  const empty = () => null
  return {
    Bar: empty,
    BarChart: passThrough,
    CartesianGrid: empty,
    Cell: empty,
    Legend: empty,
    Line: empty,
    LineChart: passThrough,
    Pie: passThrough,
    PieChart: passThrough,
    ResponsiveContainer: passThrough,
    Tooltip: empty,
    XAxis: empty,
    YAxis: empty,
  }
})

const report = {
  summary: { income: 4_200_000, expense: 1_700_000, incomeCount: 2, expenseCount: 6, netSavings: 2_500_000, savingsRate: 59.52, transactionCount: 8 },
  incomeExpense: { data: [{ date: '2026-11-01', income: 4_200_000, expense: 1_700_000 }] },
  monthly: { data: [{ date: '2026-11-01', income: 4_200_000, expense: 1_700_000 }] },
  daily: { data: [{ date: '2026-11-10', amount: 1_700_000, count: 8 }] },
  categories: { categories: [{ categoryId: 'food', name: 'Food', total: 1_700_000, percentage: 100 }] },
  wallets: { wallets: [{ _id: 'wallet', name: 'Main wallet', income: 4_200_000, expense: 1_700_000, balance: 2_500_000 }] },
  budgets: {
    budgets: [{
      _id: 'budget',
      name: 'Monthly essentials',
      amount: 2_000_000,
      progress: { budgetAmount: 2_000_000, actualSpending: 1_700_000, percentageUsed: 85, isApproachingLimit: true },
    }],
  },
  savings: {
    summary: { totalSavedAmount: 3_000_000, percentageComplete: 60 },
    goals: [{
      _id: 'goal',
      name: 'Emergency fund',
      targetAmount: 5_000_000,
      savedAmount: 3_000_000,
      progress: { targetAmount: 5_000_000, savedAmount: 3_000_000, percentageComplete: 60 },
    }],
  },
  subscriptions: {
    estimatedMonthlyCostPaise: 1_200_000,
    activeConfirmedSubscriptions: 2,
    detectedSubscriptionCount: 1,
    upcomingHorizonDays: 30,
    upcomingPayments: [{
      subscriptionId: 'subscription',
      merchantName: 'Stream service',
      expectedPaymentDate: '2026-11-15',
    }],
  },
}

function renderAnalytics() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <Analytics />
    </QueryClientProvider>,
  )
}

describe('Analytics page', () => {
  beforeEach(() => {
    getAnalyticsDashboard.mockReset().mockResolvedValue(report)
    downloadAnalyticsExport.mockReset().mockResolvedValue({ blob: new Blob(['report']), filename: 'report.csv' })
    saveAnalyticsExport.mockReset()
    toast.success.mockReset()
    toast.error.mockReset()
  })

  afterEach(cleanup)

  it('renders financial metrics and charts from backend response structures', async () => {
    renderAnalytics()

    expect(await screen.findByText('Food')).toBeInTheDocument()
    expect(screen.getByText('Total income')).toBeInTheDocument()
    expect(screen.getByText('Total expenses')).toBeInTheDocument()
    expect(screen.getByText('Net savings')).toBeInTheDocument()
    expect(screen.getByTestId('income-expense-chart')).toBeInTheDocument()
    expect(screen.getByTestId('daily-spending-chart')).toBeInTheDocument()
    expect(screen.getByTestId('category-spending-chart')).toBeInTheDocument()
    expect(screen.getByTestId('wallet-activity-chart')).toBeInTheDocument()
    expect(screen.getByText('Monthly essentials')).toBeInTheDocument()
    expect(screen.getByText('Emergency fund')).toBeInTheDocument()
    expect(screen.getByText('Stream service')).toBeInTheDocument()
    expect(document.querySelector('.xl\\:grid-cols-4')).toBeInTheDocument()
  })

  it('shows empty chart states and zero-valued summary without inventing statistics', async () => {
    getAnalyticsDashboard.mockResolvedValue({
      summary: { income: 0, expense: 0, incomeCount: 0, expenseCount: 0, netSavings: 0, savingsRate: 0, transactionCount: 0 },
      incomeExpense: { data: [] },
      monthly: { data: [] },
      daily: { data: [] },
      categories: { categories: [] },
      wallets: { wallets: [] },
      budgets: { budgets: [] },
      savings: { summary: {}, goals: [] },
      subscriptions: { upcomingPayments: [] },
    })
    renderAnalytics()

    expect(await screen.findAllByText('Nothing to chart yet')).toHaveLength(4)
    expect(screen.getByText('No active budgets to compare.')).toBeInTheDocument()
    expect(screen.getByText('No savings goals yet.')).toBeInTheDocument()
  })

  it('applies custom date filters with the account timezone', async () => {
    renderAnalytics()
    await screen.findByText('Food')
    fireEvent.change(screen.getByLabelText('Reporting period'), { target: { value: 'custom' } })
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-11-01' } })
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-11-10' } })

    await waitFor(() => {
      const [params] = getAnalyticsDashboard.mock.calls.at(-1)
      expect(params).toEqual({
        period: 'custom',
        startDate: '2026-11-01',
        endDate: '2026-11-10',
        timezone: 'Asia/Kolkata',
      })
    })
  })

  it('does not request or render a report for an invalid custom range', async () => {
    renderAnalytics()
    await screen.findByTestId('income-expense-chart')
    const callsBeforeCustom = getAnalyticsDashboard.mock.calls.length
    fireEvent.change(screen.getByLabelText('Reporting period'), { target: { value: 'custom' } })
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '' } })

    expect(await screen.findByRole('alert')).toHaveTextContent('Choose a valid date range')
    expect(screen.queryByTestId('income-expense-chart')).not.toBeInTheDocument()
    expect(getAnalyticsDashboard).toHaveBeenCalledTimes(callsBeforeCustom + 1)
  })

  it('downloads CSV/PDF using the selected API filters and reports export failures', async () => {
    renderAnalytics()
    await screen.findByText('Food')
    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }))

    await waitFor(() => expect(downloadAnalyticsExport).toHaveBeenCalledWith(
      'csv',
      { period: 'month', timezone: 'Asia/Kolkata' },
    ))
    expect(saveAnalyticsExport).toHaveBeenCalledWith(expect.objectContaining({ filename: 'report.csv' }))
    expect(toast.success).toHaveBeenCalledWith('CSV report downloaded')

    fireEvent.click(screen.getByRole('button', { name: 'Download PDF' }))
    await waitFor(() => expect(downloadAnalyticsExport).toHaveBeenNthCalledWith(
      2,
      'pdf',
      { period: 'month', timezone: 'Asia/Kolkata' },
    ))
    expect(toast.success).toHaveBeenCalledWith('PDF report downloaded')

    downloadAnalyticsExport.mockRejectedValueOnce(new Error('export unavailable'))
    fireEvent.click(screen.getByRole('button', { name: 'Download PDF' }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(
      'Could not download the PDF report. Please try again.',
    ))
  })

  it('shows a loading state while analytics are being fetched', () => {
    getAnalyticsDashboard.mockReturnValue(new Promise(() => {}))
    renderAnalytics()
    expect(screen.getByLabelText('Loading analytics')).toBeInTheDocument()
  })

  it('shows a recoverable error state', async () => {
    getAnalyticsDashboard.mockRejectedValueOnce(new Error('network failure'))
    renderAnalytics()

    expect(await screen.findByRole('heading', { name: 'Couldn’t load analytics' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })
})
