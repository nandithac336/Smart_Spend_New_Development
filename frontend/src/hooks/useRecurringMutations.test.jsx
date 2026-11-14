import { createElement } from 'react'
import { act, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cancelRecurringTransaction,
  createRecurringTransaction,
  pauseRecurringTransaction,
  resumeRecurringTransaction,
  updateRecurringTransaction,
} from '@/services/recurringApi.js'
import { useRecurringMutations } from './useRecurringMutations.js'

vi.mock('@/services/recurringApi.js', () => ({
  cancelRecurringTransaction: vi.fn(),
  createRecurringTransaction: vi.fn(),
  pauseRecurringTransaction: vi.fn(),
  resumeRecurringTransaction: vi.fn(),
  updateRecurringTransaction: vi.fn(),
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

describe('useRecurringMutations', () => {
  let queryClient
  let invalidate
  let wrapper

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient()
    invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue()
    wrapper = ({ children }) => createElement(QueryClientProvider, { client: queryClient }, children)
  })

  it('refreshes schedules and generated history after create, edit, pause, resume, and cancel', async () => {
    for (const mutation of [
      cancelRecurringTransaction,
      createRecurringTransaction,
      pauseRecurringTransaction,
      resumeRecurringTransaction,
      updateRecurringTransaction,
    ]) mutation.mockResolvedValue({})
    const { result } = renderHook(() => useRecurringMutations(), { wrapper })

    await act(async () => {
      await result.current.create.mutateAsync({})
      await result.current.update.mutateAsync({ id: 'schedule-1', payload: {} })
      await result.current.pause.mutateAsync('schedule-1')
      await result.current.resume.mutateAsync('schedule-1')
      await result.current.cancel.mutateAsync('schedule-1')
    })

    expect(invalidate).toHaveBeenCalledTimes(5)
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['recurring'] })
  })
})
