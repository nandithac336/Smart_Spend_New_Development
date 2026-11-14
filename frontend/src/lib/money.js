const AMOUNT = /^(\d+)(?:\.(\d{0,2}))?$/

export function toPaise(input) {
  let text

  if (typeof input === 'number') {
    if (!Number.isFinite(input) || input < 0) return null
    text = String(input)
  } else if (typeof input === 'string') {
    text = input.trim().replace(/[₹,\s]/g, '')
  } else {
    return null
  }

  const match = text.match(AMOUNT)
  if (!match) return null

  const [, whole, fraction] = match
  const paise = Number(whole) * 100 + Number((fraction ?? '').padEnd(2, '0'))
  return Number.isSafeInteger(paise) ? paise : null
}

export function fromPaise(paise) {
  let value
  try {
    value = Number(paise)
  } catch {
    return 0
  }
  return Number.isFinite(value) ? value / 100 : 0
}

export function formatINR(value, options = {}) {
  let numericValue
  try {
    numericValue = Number(value)
  } catch {
    numericValue = 0
  }
  if (!Number.isFinite(numericValue) || numericValue === 0) numericValue = 0

  let minimumFractionDigits = 0
  try {
    const requestedDigits = Number(options?.minimumFractionDigits)
    if (Number.isInteger(requestedDigits) && requestedDigits >= 0 && requestedDigits <= 2) {
      minimumFractionDigits = requestedDigits
    }
  } catch {
    minimumFractionDigits = 0
  }

  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits,
      maximumFractionDigits: 2,
    }).format(numericValue / 100)
  } catch {
    return '₹0'
  }
}
