import { describe, expect, it } from 'vitest'
import { formatINR, fromPaise, toPaise } from './money.js'

describe('toPaise', () => {
  it.each([
    ['120.50', 12050],
    ['0.1', 10],
    ['1,200', 120000],
    ['12.345', 1235],
    ['abc', null],
    ['', 0],
  ])('converts %j to %j paise', (value, expected) => {
    expect(toPaise(value)).toBe(expected)
  })
})

describe('formatINR', () => {
  it.each([
    [0, '₹0'],
    [12345, '₹123.45'],
    [-12345, '-₹123.45'],
    [12345600, '₹1,23,456'],
  ])('formats %i paise as %s', (paise, expected) => {
    expect(formatINR(paise)).toBe(expected)
  })
})

describe('fromPaise', () => {
  it('returns rupees as a decimal number', () => {
    expect(fromPaise(12345)).toBe(123.45)
  })
})
