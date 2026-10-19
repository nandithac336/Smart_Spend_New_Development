import { describe, expect, it } from 'vitest'
import { getErrorMessage, getFieldErrors } from './errors.js'

describe('getErrorMessage', () => {
  it('returns the API error message', () => {
    expect(getErrorMessage({
      response: { data: { error: { message: 'Invalid amount' } } },
    })).toBe('Invalid amount')
  })

  it('falls back to a transport message and then the default', () => {
    expect(getErrorMessage(new Error('Network unavailable'))).toBe('Network unavailable')
    expect(getErrorMessage({})).toBe('Something went wrong')
    expect(getErrorMessage({}, 'Could not save')).toBe('Could not save')
  })
})

describe('getFieldErrors', () => {
  it('maps backend validation details by field', () => {
    expect(getFieldErrors({
      response: {
        data: {
          error: {
            details: [
              { field: 'email', message: 'Enter a valid email' },
              { path: ['settings', 'timezone'], message: 'Unknown timezone' },
            ],
          },
        },
      },
    })).toEqual({
      email: 'Enter a valid email',
      'settings.timezone': 'Unknown timezone',
    })
  })

  it('returns an empty object when there are no field details', () => {
    expect(getFieldErrors({})).toEqual({})
  })
})
