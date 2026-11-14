import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Subscriptions from './Subscriptions.jsx'
import {
  cancelSubscription,
  confirmSubscription,
  detectSubscriptions,
  dismissSubscription,
  getSubscriptionHistory,
  getSubscriptionSummary,
  listSubscriptions,
  updateSubscription,
} from '@/services/subscriptionApi.js'
import { toast } from 'sonner'

vi.mock('@/services/subscriptionApi.js', () => ({
  cancelSubscription: vi.fn(),
  confirmSubscription: vi.fn(),
  detectSubscriptions: vi.fn(),
  dismissSubscription: vi.fn(),
  getSubscriptionHistory: vi.fn(),
  getSubscriptionSummary: vi.fn(),
  listSubscriptions: vi.fn(),
  updateSubscription: vi.fn(),
}))

vi.mock('@/hooks/useAuth.js', () => ({
  useAuth: () => ({ user: { timezone: 'Asia/Kolkata' } }),
}))

vi.mock('@/hooks/useCategories.js', () => ({
  useCategories: () => ({
    data: [{ _id: 'category-1', name: 'Entertainment' }],
    isPending: false,
    isError: false,
  }),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const detected = {
  _id: 'subscription-detected',
  merchantName: 'StreamBox',
  categoryId: 'category-1',
  averageAmountPaise: 1_299,
  lastPaymentDate: '2026-10-10T00:00:00.000Z',
  estimatedNextPaymentDate: '2026-11-10T00:00:00.000Z',
  frequency: 'monthly',
  confidenceLevel: 'high',
  confidenceScore: 91,
  status: 'detected',
  detectionEvidence: {
    transactionCount: 6,
    intervalConsistencyPercent: 96,
    amountVariationPercent: 4.2,
    historyTruncated: false,
  },
}

const confirmed = {
  ...detected,
  _id: 'subscription-confirmed',
  merchantName: 'Cloud Storage',
  status: 'confirmed',
}

const summary = {
  estimatedMonthlyCostPaise: 1_299,
  activeConfirmedSubscriptions: 1,
  detectedSubscriptionCount: 1,
  detected: { monthlyCostPaise: 1_299 },
  upcomingPayments: [{
    subscriptionId: 'subscription-detected',
    merchantName: 'StreamBox',
    expectedPaymentDate: '2026-11-10',
    estimatedAmountPaise: 1_299,
    frequency: 'monthly',
    confidenceLevel: 'high',
    confidenceScore: 91,
    status: 'detected',
  }],
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <Subscriptions />
    </QueryClientProvider>,
  )
}

describe('Subscriptions page', () => {
  beforeEach(() => {
    listSubscriptions.mockReset().mockResolvedValue({
      subscriptions: [detected, confirmed],
      pagination: { page: 1, limit: 12, total: 2, pages: 1 },
    })
    getSubscriptionSummary.mockReset().mockResolvedValue(summary)
    getSubscriptionHistory.mockReset().mockResolvedValue({
      payments: [{
        transactionId: 'transaction-1',
        paidAt: '2026-10-10T00:00:00.000Z',
        amountPaise: 1_250,
      }],
      pagination: { page: 1, limit: 20, total: 1, pages: 1 },
      historyTruncated: false,
    })
    detectSubscriptions.mockReset().mockResolvedValue({
      scannedTransactions: 12,
      detectedCount: 1,
      insufficientEvidenceCount: 2,
      historyTruncated: false,
      subscriptions: [detected],
    })
    confirmSubscription.mockReset().mockResolvedValue({ ...detected, status: 'confirmed' })
    dismissSubscription.mockReset().mockResolvedValue({ ...detected, status: 'dismissed' })
    cancelSubscription.mockReset().mockResolvedValue({ ...confirmed, status: 'cancelled' })
    updateSubscription.mockReset().mockResolvedValue(detected)
    toast.success.mockReset()
    toast.error.mockReset()
  })

  afterEach(cleanup)

  it('displays detected and confirmed subscriptions with real evidence and upcoming data', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Subscription Detection' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Confirm StreamBox' })).toBeInTheDocument()
    expect(screen.getByText('Cloud Storage')).toBeInTheDocument()
    expect(screen.getAllByText('Detected · needs review').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Confirmed').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/high · 91%/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/6 matching payments/).length).toBeGreaterThan(0)
    expect(screen.getByText('Expected in the next 30 days')).toBeInTheDocument()
    expect(screen.getByText(/does not create transactions or a recurring schedule/i)).toBeInTheDocument()
  })

  it('runs detection only after a user action and reports the result', async () => {
    renderPage()
    await screen.findByRole('button', { name: 'Confirm StreamBox' })
    fireEvent.click(screen.getByRole('button', { name: 'Check transactions' }))

    await waitFor(() => expect(detectSubscriptions).toHaveBeenCalledOnce())
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(
      'Checked 12 transactions · 1 detected for review · 2 merchant patterns need more evidence',
    ))
  })

  it('confirms and dismisses detected subscriptions through explicit backend actions', async () => {
    renderPage()
    await screen.findByRole('button', { name: 'Confirm StreamBox' })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm StreamBox' }))
    await waitFor(() => expect(confirmSubscription.mock.calls[0]?.[0]).toBe('subscription-detected'))
    expect(toast.success).toHaveBeenCalledWith('Subscription confirmed')

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss StreamBox' }))
    await waitFor(() => expect(dismissSubscription.mock.calls[0]?.[0]).toBe('subscription-detected'))
    expect(toast.success).toHaveBeenCalledWith('Subscription dismissed')
  })

  it('edits supported subscription fields with paise conversion and loads payment history', async () => {
    renderPage()
    await screen.findByRole('button', { name: 'Edit StreamBox' })
    fireEvent.click(screen.getByRole('button', { name: 'Edit StreamBox' }))
    expect(await screen.findByRole('heading', { name: 'Edit detected subscription' })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Average payment (₹)'), { target: { value: '15.50' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => {
      expect(updateSubscription.mock.calls[0]?.[0]).toBe('subscription-detected')
      expect(updateSubscription.mock.calls[0]?.[1]).toEqual(expect.objectContaining({ averageAmountPaise: 1_550 }))
    })
    expect(toast.success).toHaveBeenCalledWith('Subscription details updated')

    fireEvent.click(screen.getAllByRole('button', { name: 'Payment history' })[0])
    expect(await screen.findByRole('heading', { name: 'Observed payment history' })).toBeInTheDocument()
    expect(await screen.findByText('Transaction transaction-1')).toBeInTheDocument()
    expect(getSubscriptionHistory).toHaveBeenCalledWith('subscription-detected', { page: 1, limit: 20 })
  })

  it('filters statuses and refreshes the list and summary', async () => {
    renderPage()
    await screen.findByRole('button', { name: 'Confirm StreamBox' })
    await screen.findByRole('heading', { name: 'Expected in the next 30 days' })
    fireEvent.change(screen.getByLabelText('Review status'), { target: { value: 'confirmed' } })
    await waitFor(() => expect(listSubscriptions).toHaveBeenLastCalledWith({
      status: 'confirmed',
      page: 1,
      limit: 12,
    }))

    const refresh = screen.getByRole('button', { name: 'Refresh' })
    await waitFor(() => expect(refresh).toBeEnabled())
    fireEvent.click(refresh)
    await waitFor(() => {
      expect(listSubscriptions).toHaveBeenCalledTimes(3)
      expect(getSubscriptionSummary).toHaveBeenCalledTimes(2)
    })
  })

  it('shows loading, empty, missing-field, and recoverable error states', async () => {
    let rejectRequest
    listSubscriptions.mockImplementationOnce(() => new Promise((_, reject) => {
      rejectRequest = reject
    }))
    renderPage()
    expect(screen.getByLabelText('Loading subscriptions')).toBeInTheDocument()
    rejectRequest(new Error('network failure'))
    expect(await screen.findByRole('heading', { name: 'Could not load subscriptions' })).toBeInTheDocument()

    listSubscriptions.mockResolvedValueOnce({
      subscriptions: [{ _id: 'minimal-sub', status: 'detected' }],
      pagination: { page: 1, limit: 12, total: 1, pages: 1 },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Unnamed merchant')).toBeInTheDocument()
    expect(screen.getByText(/Frequency unavailable/)).toBeInTheDocument()
    expect(screen.getByText('Amount unavailable')).toBeInTheDocument()
    expect(screen.getByText('Not provided')).toBeInTheDocument()

    listSubscriptions.mockResolvedValueOnce({
      subscriptions: [],
      pagination: { page: 1, limit: 12, total: 0, pages: 0 },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    expect(await screen.findByRole('heading', { name: 'No subscriptions to show' })).toBeInTheDocument()
  })

  it('shows subscription cancellation as app tracking only', async () => {
    renderPage()
    await screen.findByRole('button', { name: 'Cancel Cloud Storage' })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel Cloud Storage' }))
    expect(await screen.findByRole('heading', { name: 'Cancel this confirmed subscription?' })).toBeInTheDocument()
    expect(screen.getByText(/does not cancel the service with the merchant/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel tracking' }))
    await waitFor(() => expect(cancelSubscription).toHaveBeenCalledWith('subscription-confirmed', expect.any(Object)))
  })
})
