const AMOUNT_PATTERN = /^([+-]?)(\d+)(?:\.(\d*))?$/

export function toPaise(value) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null
    return Math.round(Math.abs(value) * 100 + Number.EPSILON) * Math.sign(value)
  }
  if (typeof value !== 'string') return null

  const normalized = value.trim().replace(/[₹,\s]/g, '')
  if (!normalized) return 0

  const match = normalized.match(AMOUNT_PATTERN)
  if (!match) return null

  const [, sign, rupees, fraction = ''] = match
  const paise = Number(rupees) * 100 + Number((fraction.slice(0, 2) + '00').slice(0, 2))
  const rounded = paise + (Number(fraction[2] ?? 0) >= 5 ? 1 : 0)
  return sign === '-' ? -rounded : rounded
}

export function fromPaise(paise) {
  if (!Number.isFinite(Number(paise))) {
    throw new TypeError('Paise must be a finite number')
  }
  return Number(paise) / 100
}

export function formatINR(paise) {
  if (!Number.isFinite(Number(paise))) {
    throw new TypeError('Paise must be a finite number')
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(paise) / 100)
}
