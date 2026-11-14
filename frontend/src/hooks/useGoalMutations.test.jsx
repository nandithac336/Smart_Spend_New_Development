import { createElement } from 'react'
import { act, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  addGoalContribution,
  archiveGoal,
  createGoal,
  pauseGoal,
  resumeGoal,
  updateGoal,
} from '@/services/goalApi.js'
import { useGoalMutations } from './useGoalMutations.js'

vi.mock('@/services/goalApi.js', () => ({
  addGoalContribution: vi.fn(),
  archiveGoal: vi.fn(),
  createGoal: vi.fn(),
  pauseGoal: vi.fn(),
  resumeGoal: vi.fn(),
  updateGoal: vi.fn(),
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

describe('useGoalMutations', () => {
  let queryClient
  let invalidate
  let wrapper

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient()
    invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue()
    wrapper = ({ children }) => createElement(QueryClientProvider, { client: queryClient }, children)
  })

  it('refreshes goal data after create, edit, contribution, pause, resume, and archive', async () => {
    for (const mutation of [addGoalContribution, archiveGoal, createGoal, pauseGoal, resumeGoal, updateGoal]) {
      mutation.mockResolvedValue({})
    }
    const { result } = renderHook(() => useGoalMutations(), { wrapper })

    await act(async () => {
      await result.current.create.mutateAsync({})
      await result.current.update.mutateAsync({ id: 'goal-1', payload: {} })
      await result.current.contribute.mutateAsync({ id: 'goal-1', payload: {} })
      await result.current.pause.mutateAsync('goal-1')
      await result.current.resume.mutateAsync('goal-1')
      await result.current.archive.mutateAsync('goal-1')
    })

    expect(invalidate).toHaveBeenCalledTimes(6)
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['goals'] })
  })
})
