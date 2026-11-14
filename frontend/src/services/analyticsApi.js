import api from './api.js'

export async function getTransactionSummary(params) {
  const response = await api.get('/analytics/summary', { params })
  return response.data.data
}

async function getAnalyticsEndpoint(path, params) {
  const response = await api.get(path, { params })
  return response.data.data
}

export async function getAnalyticsDashboard(params, includeDaily) {
  const requests = [
    getAnalyticsEndpoint('/analytics/summary', params),
    getAnalyticsEndpoint('/analytics/income-expense', params),
    getAnalyticsEndpoint('/analytics/monthly', params),
    getAnalyticsEndpoint('/analytics/categories', { ...params, type: 'expense' }),
    getAnalyticsEndpoint('/analytics/wallets', params),
    getAnalyticsEndpoint('/analytics/budgets', { timezone: params.timezone }),
    getAnalyticsEndpoint('/analytics/savings', { timezone: params.timezone }),
    getAnalyticsEndpoint('/analytics/subscriptions', {}),
  ]

  if (includeDaily) requests.push(getAnalyticsEndpoint('/analytics/daily', params))
  const [summary, incomeExpense, monthly, categories, wallets, budgets, savings, subscriptions, daily] =
    await Promise.all(requests)

  return {
    summary,
    incomeExpense,
    monthly,
    categories,
    wallets,
    budgets,
    savings,
    subscriptions,
    daily: includeDaily ? daily : null,
  }
}

export async function downloadAnalyticsExport(format, params) {
  if (format !== 'csv' && format !== 'pdf') throw new Error('Unsupported report format')
  const endpoint = format === 'csv' ? '/export/transactions/csv' : '/export/transactions/pdf'
  const response = await api.get(endpoint, { params, responseType: 'blob' })
  const disposition = response.headers?.['content-disposition'] ?? ''
  const filename = disposition.match(/filename="([^"]+)"/i)?.[1]
    ?? `smart-spend-report.${format}`
  const type = format === 'csv' ? 'text/csv;charset=utf-8' : 'application/pdf'
  return { blob: new Blob([response.data], { type }), filename }
}

export function saveAnalyticsExport({ blob, filename }) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
}
