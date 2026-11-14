import { describe, expect, it } from 'vitest'
import {
  getAnalyticsDayCount,
  getAnalyticsDefaults,
  getAnalyticsParams,
  isCalendarDate,
  isValidAnalyticsRange,
} from './analyticsFilters.js'

describe('analytics date filters', () => {
  it('creates default calendar bounds in the selected timezone', () => {
    expect(getAnalyticsDefaults('Asia/Kolkata', new Date('2026-11-10T12:00:00.000Z'))).toEqual({
      period: 'month',
      startDate: '2026-11-01',
      endDate: '2026-11-10',
    })
    expect(getAnalyticsDefaults('America/Los_Angeles', new Date('2026-01-01T04:30:00.000Z'))).toEqual({
      period: 'month',
      startDate: '2025-12-01',
      endDate: '2025-12-31',
    })
  })

  it('accepts only real calendar dates and ordered ranges', () => {
    expect(isCalendarDate('2024-02-29')).toBe(true)
    expect(isCalendarDate('2026-02-29')).toBe(false)
    expect(isValidAnalyticsRange('2026-11-01', '2026-11-10')).toBe(true)
    expect(isValidAnalyticsRange('2026-11-11', '2026-11-10')).toBe(false)
    expect(isValidAnalyticsRange('', '2026-11-10')).toBe(false)
  })

  it('counts inclusive calendar days and keeps the selected timezone on API parameters', () => {
    expect(getAnalyticsDayCount('2026-11-01', '2026-11-30')).toBe(30)
    expect(getAnalyticsDayCount('2026-02-30', '2026-03-01')).toBe(0)
    expect(getAnalyticsParams({
      period: 'custom',
      startDate: '2026-11-01',
      endDate: '2026-11-10',
      timeZone: 'Asia/Kolkata',
    })).toEqual({
      period: 'custom',
      startDate: '2026-11-01',
      endDate: '2026-11-10',
      timezone: 'Asia/Kolkata',
    })
  })
})
