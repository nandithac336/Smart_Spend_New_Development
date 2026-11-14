import { describe, expect, it } from 'vitest'
import { formatINR, fromPaise, toPaise } from './money.js'

describe('toPaise', () => {
  it.each([
    ['120.50', 12050],
    ['0.1', 10],
    ['1,200', 120000],
    ['₹ 1,200.5', 120050],
    ['5.', 500],
    ['12.345', null],
    ['', null],
    ['   ', null],
    ['-5', null],
    ['.5', null],
    ['abc', null],
    ['1e3', null],
    [1e21, null],
    [12.5, 1250],
    [-3, null],
    [NaN, null],
  ])('converts %j to %j paise', (value, expected) => {
    expect(toPaise(value)).toBe(expected)
  })
})

describe('formatINR', () => {
  it.each([
    [12345600, '₹1,23,456'],
    [0, '₹0'],
    [null, '₹0'],
    [undefined, '₹0'],
    [NaN, '₹0'],
    ['not a number', '₹0'],
    [-4000, '-₹40'],
    [-0, '₹0'],
  ])('formats %i paise as %s', (paise, expected) => {
    expect(formatINR(paise)).toBe(expected)
  })

  it('formats amounts with the requested minimum precision', () => {
    expect(formatINR(12050, { minimumFractionDigits: 2 })).toBe('₹120.50')
  })

  it('returns zero when converting invalid input from paise', () => {
    expect(fromPaise(Infinity)).toBe(0)
  })
})

describe('fromPaise', () => {
  it('returns rupees as a decimal number', () => {
    expect(fromPaise(12345)).toBe(123.45)
  })
})
