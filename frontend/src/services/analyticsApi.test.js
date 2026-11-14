import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from './api.js'
import { downloadAnalyticsExport, getAnalyticsDashboard, getTransactionSummary, saveAnalyticsExport } from './analyticsApi.js'

vi.mock('./api.js', () => ({ default: { get: vi.fn() } }))

describe('analytics API client', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.get.mockImplementation(async (path) => ({ data: { data: { path } } }))
  })

  it('loads real summary, trend, category, wallet, planning and subscription endpoints', async () => {
    const params = { period: 'month', timezone: 'Asia/Kolkata' }
    const result = await getAnalyticsDashboard(params, true)

    expect(result.summary).toEqual({ path: '/analytics/summary' })
    expect(result.incomeExpense).toEqual({ path: '/analytics/income-expense' })
    expect(result.monthly).toEqual({ path: '/analytics/monthly' })
    expect(result.categories).toEqual({ path: '/analytics/categories' })
    expect(result.wallets).toEqual({ path: '/analytics/wallets' })
    expect(result.budgets).toEqual({ path: '/analytics/budgets' })
    expect(result.savings).toEqual({ path: '/analytics/savings' })
    expect(result.subscriptions).toEqual({ path: '/analytics/subscriptions' })
    expect(result.daily).toEqual({ path: '/analytics/daily' })
    expect(api.get).toHaveBeenCalledWith('/analytics/categories', { params: { ...params, type: 'expense' } })
    expect(api.get).toHaveBeenCalledTimes(9)
  })

  it('skips the daily endpoint when the selected range is too long', async () => {
    const result = await getAnalyticsDashboard({ period: 'custom', timezone: 'Asia/Kolkata' }, false)
    expect(result.daily).toBeNull()
    expect(api.get).toHaveBeenCalledTimes(8)
    expect(api.get).not.toHaveBeenCalledWith('/analytics/daily', expect.anything())
  })

  it('retains the summary helper and requests CSV and PDF exports with the selected filters', async () => {
    const params = { startDate: '2026-11-01', endDate: '2026-11-30', timezone: 'Asia/Kolkata' }
    await getTransactionSummary(params)
    expect(api.get).toHaveBeenCalledWith('/analytics/summary', { params })

    api.get.mockResolvedValueOnce({
      data: new Blob(['csv']),
      headers: { 'content-disposition': 'attachment; filename="period.csv"' },
    })
    const result = await downloadAnalyticsExport('csv', params)
    expect(api.get).toHaveBeenLastCalledWith('/export/transactions/csv', {
      params,
      responseType: 'blob',
    })
    expect(result.filename).toBe('period.csv')
    expect(result.blob.type).toBe('text/csv;charset=utf-8')

    api.get.mockResolvedValueOnce({
      data: new Blob(['%PDF']),
      headers: { 'content-disposition': 'attachment; filename="financial-report.pdf"' },
    })
    const pdf = await downloadAnalyticsExport('pdf', params)
    expect(api.get).toHaveBeenLastCalledWith('/export/transactions/pdf', {
      params,
      responseType: 'blob',
    })
    expect(pdf.filename).toBe('financial-report.pdf')
    expect(pdf.blob.type).toBe('application/pdf')
  })

  it('rejects unsupported export formats and triggers a browser download for report blobs', async () => {
    await expect(downloadAnalyticsExport('xlsx', {})).rejects.toThrow('Unsupported report format')
    const createObjectURL = vi.fn().mockReturnValue('blob:smart-spend-report')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    vi.useFakeTimers()

    saveAnalyticsExport({ blob: new Blob(['pdf']), filename: 'report.pdf' })

    expect(createObjectURL).toHaveBeenCalledOnce()
    expect(click).toHaveBeenCalledOnce()
    expect(document.querySelector('a[download="report.pdf"]')).toBeNull()
    vi.advanceTimersByTime(1_000)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:smart-spend-report')

    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })
})
