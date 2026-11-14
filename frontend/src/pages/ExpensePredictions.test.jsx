import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ExpensePredictions from './ExpensePredictions.jsx'
import { getExpensePredictionData } from '@/services/predictionApi.js'
import { toast } from 'sonner'

vi.mock('@/services/predictionApi.js', () => ({
  getExpensePredictionData: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/hooks/useMotionDisabled.js', () => ({
  useMotionDisabled: () => false,
}))

vi.mock('recharts', () => {
  const passThrough = ({ children }) => children ?? null
  const empty = () => null
  return {
    Bar: empty,
    BarChart: passThrough,
    CartesianGrid: empty,
    Legend: empty,
    Line: empty,
    LineChart: passThrough,
    ResponsiveContainer: passThrough,
    Tooltip: empty,
    XAxis: empty,
    YAxis: empty,
  }
})

const predictionData = {
  overview: {
    timezone: 'Asia/Kolkata',
    limitations: ['This is a statistical estimate, not a guarantee or financial advice.'],
    currentMonth: {
      status: 'ok',
      forecastPeriod: '2026-11',
      predictedAmountPaise: 3_600_000,
      actualMonthToDatePaise: 1_200_000,
      knownRecurringPaise: 450_000,
      knownSubscriptionPaise: 120_000,
      confidence: { level: 'medium', historicalSampleSize: 6 },
      modelMethodology: 'Historical monthly averages.',
    },
    nextMonth: {
      status: 'ok',
      forecastPeriod: '2026-12',
      predictedAmountPaise: 4_000_000,
      actualMonthToDatePaise: 0,
      knownRecurringPaise: 500_000,
      confidence: { level: 'medium', historicalSampleSize: 6 },
    },
  },
  categories: {
    status: 'ok',
    forecastPeriod: '2026-11',
    methodology: 'Category forecast from confirmed history.',
    categoriesTruncated: false,
    categories: [
      {
        categoryId: 'food',
        name: 'Food',
        icon: '🍲',
        status: 'ok',
        predictedAmountPaise: 1_500_000,
        previousMonthActualPaise: 1_300_000,
        actualMonthToDatePaise: 500_000,
        knownRecurringPaise: 150_000,
        historicalSampleSize: 6,
      },
      {
        categoryId: 'utilities',
        name: 'Utilities',
        icon: '⚡',
        status: 'insufficient_data',
        predictedAmountPaise: null,
        previousMonthActualPaise: 0,
        actualMonthToDatePaise: 0,
        knownRecurringPaise: 300_000,
        historicalSampleSize: 1,
      },
    ],
  },
  daily: {
    timezone: 'Asia/Kolkata',
    data: [
      { date: '2026-11-09', status: 'actual', actualAmountPaise: 40_000, predictedAmountPaise: 40_000, knownRecurringPaise: 0 },
      { date: '2026-11-10', status: 'forecast', actualAmountPaise: null, predictedAmountPaise: 110_000, knownRecurringPaise: 60_000 },
    ],
  },
  selectedMonth: '2026-11',
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <ExpensePredictions />
    </QueryClientProvider>,
  )
}

describe('Expense Predictions page', () => {
  beforeEach(() => {
    getExpensePredictionData.mockReset().mockResolvedValue(predictionData)
    toast.success.mockReset()
    toast.error.mockReset()
  })

  afterEach(cleanup)

  it('shows backend forecasts, historical category comparisons and distinct scheduled amounts', async () => {
    renderPage()

    expect(await screen.findByText('November 2026')).toBeInTheDocument()
    expect(screen.getByText('Expected total')).toBeInTheDocument()
    expect(screen.getByText('History coverage')).toBeInTheDocument()
    expect(screen.getByText('6 months')).toBeInTheDocument()
    expect(screen.getByText('Forecast confidence: medium')).toBeInTheDocument()
    expect(screen.getByTestId('prediction-category-chart')).toBeInTheDocument()
    expect(screen.getByTestId('prediction-daily-chart')).toBeInTheDocument()
    expect(screen.getByText('Food')).toBeInTheDocument()
    expect(screen.getByText('Utilities')).toBeInTheDocument()
    expect(screen.getByText(/Known scheduled/)).toBeInTheDocument()
    expect(screen.getByText(/scheduled payments are not newly created transactions/i)).toBeInTheDocument()
  })

  it('selects only the current or next period supplied by the backend', async () => {
    getExpensePredictionData.mockImplementation(async (month) => ({
      ...predictionData,
      selectedMonth: month || '2026-11',
      categories: { ...predictionData.categories, forecastPeriod: month || '2026-11' },
    }))
    renderPage()
    await screen.findByText('November 2026')

    fireEvent.click(screen.getByRole('button', { name: /Next month/ }))

    await waitFor(() => expect(getExpensePredictionData).toHaveBeenLastCalledWith('2026-12'))
    expect(await screen.findByText('December 2026')).toBeInTheDocument()
  })

  it('reports insufficient history without inventing a forecast amount', async () => {
    getExpensePredictionData.mockResolvedValue({
      ...predictionData,
      overview: {
        ...predictionData.overview,
        currentMonth: {
          ...predictionData.overview.currentMonth,
          status: 'insufficient_data',
          predictedAmountPaise: null,
          message: 'At least three active historical months are needed for a reliable estimate.',
          confidence: { level: 'insufficient', historicalSampleSize: 0 },
        },
      },
      categories: {
        ...predictionData.categories,
        categories: predictionData.categories.categories.map((item) => ({
          ...item,
          status: 'insufficient_data',
          predictedAmountPaise: null,
        })),
      },
      daily: { ...predictionData.daily, data: [] },
    })
    renderPage()

    expect(await screen.findByText('More history is needed for a reliable estimate')).toBeInTheDocument()
    expect(screen.getByText('Not enough history')).toBeInTheDocument()
    expect(screen.getAllByText('Not enough data to chart')).toHaveLength(2)
    expect(screen.queryByText('Forecast confidence: insufficient')).not.toBeInTheDocument()
  })

  it('shows loading and recoverable error states and can retry', async () => {
    let rejectRequest
    getExpensePredictionData.mockImplementationOnce(() => new Promise((_, reject) => {
      rejectRequest = reject
    }))
    renderPage()
    expect(screen.getByLabelText('Loading expense predictions')).toBeInTheDocument()

    rejectRequest(new Error('network failure'))
    expect(await screen.findByRole('heading', { name: 'Couldn’t load predictions' })).toBeInTheDocument()
    getExpensePredictionData.mockResolvedValueOnce(predictionData)
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('November 2026')).toBeInTheDocument()
  })

  it('refreshes the selected prediction and reports failures', async () => {
    renderPage()
    await screen.findByText('November 2026')
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))

    await waitFor(() => expect(getExpensePredictionData).toHaveBeenCalledTimes(2))
    expect(toast.success).toHaveBeenCalledWith('Expense predictions refreshed')

    getExpensePredictionData.mockRejectedValueOnce(new Error('refresh failed'))
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Could not refresh predictions. Please try again.'))
  })
})
