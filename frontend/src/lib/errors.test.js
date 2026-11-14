import { describe, expect, it } from 'vitest'
import { getErrorMessage, getFieldErrors } from './errors.js'

describe('getErrorMessage', () => {
  it('returns the API error message', () => {
    expect(getErrorMessage({
      response: { data: { error: { message: 'Invalid amount' } } },
    })).toBe('Invalid amount')
  })

  it('returns a friendly message for network errors', () => {
    expect(getErrorMessage({ code: 'ERR_NETWORK' }))
      .toBe("Can't reach the server. Is the backend running?")
    expect(getErrorMessage({ request: {} }))
      .toBe("Can't reach the server. Is the backend running?")
  })

  it('returns a friendly message for rate limiting', () => {
    expect(getErrorMessage({ response: { status: 429, data: {} } }))
      .toBe('Too many attempts. Please wait a few minutes.')
  })

  it('uses the API response message or fallback without exposing technical errors', () => {
    expect(getErrorMessage({ response: { status: 400, data: { message: 'Invalid request' } } }))
      .toBe('Invalid request')
    expect(getErrorMessage({})).toBe('Something went wrong')
    expect(getErrorMessage({}, 'Could not save')).toBe('Could not save')
    expect(getErrorMessage(new Error('Network Error'))).toBe('Something went wrong')
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
