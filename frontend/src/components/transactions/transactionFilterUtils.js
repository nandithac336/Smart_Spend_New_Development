import { toPaise } from '@/lib/money.js'

export function filterChips(params) {
  const chips = []
  const labels = {
    type: { expense: 'Expense', income: 'Income', transfer: 'Transfer' },
    datePreset: { today: 'Today', week: 'This week', month: 'This month', year: 'This year', custom: 'Custom dates' },
  }
  for (const key of ['q', 'type', 'walletId', 'categoryId', 'datePreset', 'minAmount', 'maxAmount', 'tag']) {
    const value = params.get(key)
    if (!value || value === 'all' || value === 'none') continue
    const label = key === 'q' ? `Search: ${value}`
      : key === 'type' ? labels.type[value] ?? value
        : key === 'walletId' ? `Wallet: ${value}`
          : key === 'categoryId' ? `Category: ${value}`
            : key === 'datePreset' ? labels.datePreset[value] ?? value
              : key === 'minAmount' ? `Min: ₹${value}`
                : key === 'maxAmount' ? `Max: ₹${value}`
                  : `Tag: ${value}`
    chips.push({ key, label })
  }
  if (params.has('fromDate')) chips.push({ key: 'fromDate', label: `From: ${params.get('fromDate')}` })
  if (params.has('toDate')) chips.push({ key: 'toDate', label: `To: ${params.get('toDate')}` })
  if (!params.has('datePreset') && (params.has('from') || params.has('to'))) chips.push({ key: 'from', label: 'Date range' })
  return chips
}

export function removeFilter(key, setParams) {
  setParams((current) => {
    const next = new URLSearchParams(current)
    if (key === 'fromDate' || key === 'toDate' || key === 'from') {
      next.delete('from')
      next.delete('to')
      next.delete('fromDate')
      next.delete('toDate')
      next.delete('datePreset')
    } else {
      next.delete(key)
      if (key === 'datePreset') {
        next.delete('from')
        next.delete('to')
        next.delete('fromDate')
        next.delete('toDate')
      }
    }
    return next
  }, { replace: true })
}

export function transactionFiltersFromParams(params) {
  const filters = {}
  for (const key of ['type', 'walletId', 'categoryId', 'tag', 'q', 'from', 'to']) {
    const value = params.get(key)
    if (value) filters[key] = value
  }
  const minimum = params.get('minAmount')
  const maximum = params.get('maxAmount')
  if (minimum !== null && minimum !== '') {
    const paise = toPaise(minimum)
    if (paise !== null) filters.minAmount = paise
  }
  if (maximum !== null && maximum !== '') {
    const paise = toPaise(maximum)
    if (paise !== null) filters.maxAmount = paise
  }
  return filters
}

export function activeTransactionFilterCount(params) {
  const otherFilters = ['q', 'type', 'walletId', 'categoryId', 'minAmount', 'maxAmount', 'tag']
    .filter((key) => {
      const value = params.get(key)
      return Boolean(value && value !== 'all' && value !== 'none')
    }).length
  return otherFilters + (params.has('datePreset') || params.has('from') || params.has('to') ? 1 : 0)
}
