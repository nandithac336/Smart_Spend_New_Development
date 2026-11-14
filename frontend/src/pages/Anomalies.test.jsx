import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Anomalies from './Anomalies.jsx'
import { detectAnomalies, getAnomalySummary, listAnomalies, updateAnomalyStatus } from '@/services/anomalyApi.js'

vi.mock('@/services/anomalyApi.js', () => ({
  detectAnomalies: vi.fn(),
  getAnomalySummary: vi.fn(),
  listAnomalies: vi.fn(),
  updateAnomalyStatus: vi.fn(),
}))
vi.mock('@/hooks/useAuth.js', () => ({ useAuth: () => ({ user: { timezone: 'Asia/Kolkata' } }) }))
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }))

const result = { anomalies: [], pagination: { page: 1, limit: 20, total: 0, pages: 0 } }
const summary = { total: 0, new: 0, highAndCritical: 0, reviewed: 0, dismissed: 0, resolved: 0, bySeverity: {} }

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Anomalies />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return client
}

describe('Anomaly Detection page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listAnomalies.mockResolvedValue(result)
    getAnomalySummary.mockResolvedValue(summary)
    detectAnomalies.mockResolvedValue({ scannedCount: 2, anomalies: [], insufficientBaselineCount: 1 })
    updateAnomalyStatus.mockResolvedValue({ _id: 'anomaly-1', status: 'reviewed' })
  })
  afterEach(cleanup)

  it('shows an honest empty state and starts a backend scan on request', async () => {
    renderPage()

    expect(await screen.findByText('No unusual activity found')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Check recent activity' }))

    expect(await screen.findByText(/Checked 2 confirmed transactions/)).toBeInTheDocument()
    expect(detectAnomalies).toHaveBeenCalledWith({}, expect.objectContaining({ client: expect.any(QueryClient) }))
  })

  it('filters by severity, status, and detected date using supported query parameters', async () => {
    renderPage()
    await screen.findByText('No unusual activity found')

    fireEvent.change(screen.getByLabelText('Severity'), { target: { value: 'high' } })
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'new' } })
    fireEvent.change(screen.getByLabelText('Detected from'), { target: { value: '2026-11-01' } })
    fireEvent.change(screen.getByLabelText('Detected to'), { target: { value: '2026-11-10' } })

    await waitFor(() => expect(listAnomalies).toHaveBeenLastCalledWith({
      severity: 'high',
      status: 'new',
      startDate: '2026-11-01',
      endDate: '2026-11-10',
      page: 1,
      limit: 20,
    }))
  })

  it('uses the selected range for detection and prevents invalid ranges from being submitted', async () => {
    renderPage()
    await screen.findByText('No unusual activity found')
    fireEvent.change(screen.getByLabelText('Detected from'), { target: { value: '2026-11-01' } })
    fireEvent.change(screen.getByLabelText('Detected to'), { target: { value: '2026-11-10' } })
    fireEvent.click(screen.getByRole('button', { name: 'Check recent activity' }))

    await waitFor(() => expect(detectAnomalies).toHaveBeenCalledWith(
      { startDate: '2026-11-01', endDate: '2026-11-10' },
      expect.objectContaining({ client: expect.any(QueryClient) }),
    ))
  })

  it('shows a recoverable list failure', async () => {
    listAnomalies.mockRejectedValueOnce(new Error('offline'))
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Couldn’t load unusual activity' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(listAnomalies).toHaveBeenCalledTimes(2))
  })

  it('offers dismiss and reviewed actions for a returned backend anomaly', async () => {
    listAnomalies.mockResolvedValue({
      anomalies: [{
        _id: 'anomaly-1',
        anomalyType: 'new_merchant',
        severity: 'medium',
        score: 35,
        status: 'new',
        explanation: 'A new merchant appears in your records.',
        suggestedAction: 'Check details if unrecognized.',
        detectedAt: '2026-11-10T12:00:00.000Z',
        transactionId: {
          _id: 'transaction-1',
          type: 'expense',
          amount: 500,
          merchant: 'New Shop',
          txnDate: '2026-11-10T12:00:00.000Z',
          walletId: { _id: 'wallet-1', name: 'Main wallet' },
          categoryId: { _id: 'category-1', name: 'Shopping' },
        },
      }],
      pagination: { page: 1, limit: 20, total: 1, pages: 1 },
    })
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Mark reviewed' }))
    await waitFor(() => expect(updateAnomalyStatus).toHaveBeenCalledWith('anomaly-1', 'reviewed'))
  })

  it('shows an error when the scan action fails', async () => {
    detectAnomalies.mockRejectedValueOnce(new Error('scan failure'))
    renderPage()
    await screen.findByText('No unusual activity found')
    fireEvent.click(screen.getByRole('button', { name: 'Check recent activity' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Couldn’t check recent transactions')
  })
})
