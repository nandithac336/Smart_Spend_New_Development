import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LazyMotion, domMax } from 'motion/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import FinancialHealth from './FinancialHealth.jsx'
import { getFinancialHealth } from '@/services/financialHealthApi.js'
import { toast } from 'sonner'

vi.mock('@/services/financialHealthApi.js', () => ({
  getFinancialHealth: vi.fn(),
}))

vi.mock('@/hooks/useMotionDisabled.js', () => ({
  useMotionDisabled: () => false,
}))

vi.mock('@/hooks/useLowPower.js', () => ({
  useLowPower: () => ({ lowPower: false }),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('recharts', () => {
  const passThrough = ({ children }) => children ?? null
  const empty = () => null
  return {
    CartesianGrid: empty,
    Line: empty,
    LineChart: passThrough,
    ResponsiveContainer: passThrough,
    Tooltip: empty,
    XAxis: empty,
    YAxis: empty,
  }
})

const healthData = {
  score: 72,
  grade: 'good',
  positiveHabits: [{
    name: 'Income versus expenses',
    score: 86,
    explanation: 'Recorded income is higher than expenses.',
  }],
  areasNeedingImprovement: [{
    name: 'Savings rate',
    score: 42,
    explanation: 'The savings rate can improve.',
    suggestions: ['Set a manageable savings target.'],
  }],
  dimensions: [
    {
      name: 'Income versus expenses',
      score: 86,
      weight: 50,
      explanation: 'Average monthly expenses are 70% of average monthly income.',
      figures: {
        averageMonthlyIncomePaise: 100_000,
        averageMonthlyExpensesPaise: 70_000,
      },
      improvementSuggestions: [],
    },
    {
      name: 'Savings rate',
      score: 42,
      weight: 30,
      explanation: 'The period savings rate is 30%.',
      figures: { netSavingsPaise: 90_000, savingsRatePercent: 30 },
      improvementSuggestions: ['Set a manageable savings target.'],
    },
    {
      name: 'Spending consistency and trends',
      score: 76,
      weight: 20,
      explanation: 'Monthly expense changes are shown.',
      figures: {
        monthlyExpensesPaise: [
          { month: '2026-08', amountPaise: 60_000 },
          { month: '2026-09', amountPaise: 70_000 },
          { month: '2026-10', amountPaise: 70_000 },
        ],
      },
      improvementSuggestions: ['Review unusually high months.'],
    },
  ],
  normalizedWeightTotal: 100,
  dataConfidence: { level: 'medium', transactionCount: 18, activeMonths: 3 },
  period: { startDate: '2026-08', endDate: '2026-10-31', timeZone: 'Asia/Kolkata' },
  limitations: ['This score only reflects information recorded in SmartSpend.'],
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return render(
    <LazyMotion features={domMax}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <FinancialHealth />
        </MemoryRouter>
      </QueryClientProvider>
    </LazyMotion>,
  )
}

describe('Financial Health page', () => {
  beforeEach(() => {
    getFinancialHealth.mockReset().mockResolvedValue(healthData)
    toast.success.mockReset()
    toast.error.mockReset()
  })

  afterEach(cleanup)

  it('renders the backend score, indicators, overview and stated limitations', async () => {
    renderPage()

    expect(await screen.findByRole('img', { name: 'Financial health score 72 out of 100' })).toBeInTheDocument()
    expect(screen.getByText('Good')).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { name: 'Income versus expenses' })).toHaveLength(2)
    expect(screen.getAllByRole('heading', { name: 'Savings rate' })).toHaveLength(2)
    expect(screen.getByText('Score weight: 50%')).toBeInTheDocument()
    expect(screen.getByText('Average monthly income')).toBeInTheDocument()
    expect(screen.getByText('Net savings in period')).toBeInTheDocument()
    expect(screen.getByTestId('financial-health-expense-chart')).toBeInTheDocument()
    expect(screen.getByText(/Historical score records are not available/)).toBeInTheDocument()
    expect(screen.getByText('This score only reflects information recorded in SmartSpend.')).toBeInTheDocument()
  })

  it('shows backend strengths, improvement areas, recommendations and only existing destinations', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Financial strengths' })).toBeInTheDocument()
    expect(screen.getByText('Recorded income is higher than expenses.')).toBeInTheDocument()
    expect(screen.getByText('The savings rate can improve.')).toBeInTheDocument()
    expect(screen.getAllByText('Set a manageable savings target.')).toHaveLength(2)
    expect(screen.getAllByRole('link', { name: 'View savings goals' }).every((link) => link.getAttribute('href') === '/goals')).toBe(true)
    expect(screen.getByRole('link', { name: 'Open analytics' })).toHaveAttribute('href', '/analytics')
  })

  it('does not fabricate a score when the backend reports insufficient history', async () => {
    getFinancialHealth.mockResolvedValueOnce({
      score: null,
      grade: 'insufficient_data',
      dimensions: [],
      positiveHabits: [],
      areasNeedingImprovement: [],
      dataConfidence: { level: 'limited', transactionCount: 0, activeMonths: 0 },
      limitations: [],
    })
    renderPage()

    expect(await screen.findByRole('heading', { name: 'More financial activity is needed' })).toBeInTheDocument()
    expect(screen.getByText(/No score has been estimated/)).toBeInTheDocument()
    expect(screen.queryByText('0 out of 100')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Add transactions' })).toHaveAttribute('href', '/transactions')
  })

  it('handles missing indicators and figures without rendering fake zero values', async () => {
    getFinancialHealth.mockResolvedValueOnce({
      score: 0,
      grade: 'needs_attention',
      dimensions: [null, { name: 'Unavailable score', score: null }],
      positiveHabits: null,
      areasNeedingImprovement: null,
      dataConfidence: {},
      period: {},
      limitations: [],
    })
    renderPage()

    expect(await screen.findByRole('img', { name: 'Financial health score 0 out of 100' })).toBeInTheDocument()
    expect(screen.getByText('Not provided')).toBeInTheDocument()
    expect(screen.getByText('No overview figures were returned for this score.')).toBeInTheDocument()
    expect(screen.queryByText('₹0')).not.toBeInTheDocument()
  })

  it('shows a loading skeleton without score placeholders', () => {
    getFinancialHealth.mockImplementationOnce(() => new Promise(() => {}))
    renderPage()

    expect(screen.getByLabelText('Loading financial health score')).toHaveAttribute('aria-busy', 'true')
    expect(screen.queryByText('out of 100')).not.toBeInTheDocument()
  })

  it('shows a recoverable error and retries the request', async () => {
    getFinancialHealth.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(healthData)
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Couldn’t load your financial health score' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Financial health score')).toBeInTheDocument()
    await waitFor(() => expect(getFinancialHealth).toHaveBeenCalledTimes(2))
  })

  it('refreshes data through the query and reports completion', async () => {
    renderPage()
    await screen.findByRole('img', { name: 'Financial health score 72 out of 100' })
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))

    await waitFor(() => expect(getFinancialHealth).toHaveBeenCalledTimes(2))
    expect(toast.success).toHaveBeenCalledWith('Financial health score refreshed')
  })
})
