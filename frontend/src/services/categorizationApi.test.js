import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from './api.js'
import { acceptCategorySuggestion, listCategorySuggestions, rejectCategorySuggestion } from './categorizationApi.js'

vi.mock('./api.js', () => ({ default: { get: vi.fn(), post: vi.fn() } }))

describe('categorization API', () => {
  beforeEach(() => vi.clearAllMocks())

  it('requests the existing suggestion list and returns its pagination metadata', async () => {
    const suggestions = [{ _id: 'suggestion-1', confidence: 0.8 }]
    const pagination = { page: 2, limit: 20, total: 21, pages: 2 }
    api.get.mockResolvedValue({ data: { success: true, data: suggestions, pagination } })

    await expect(listCategorySuggestions({ page: 2, limit: 20, status: 'pending' }))
      .resolves.toEqual({ suggestions, pagination })
    expect(api.get).toHaveBeenCalledWith('/categorization/suggestions', {
      params: { page: 2, limit: 20, status: 'pending' },
    })
  })

  it('accepts a suggested category or an explicitly selected category', async () => {
    api.post.mockResolvedValue({ data: { success: true } })

    await acceptCategorySuggestion('suggestion-1')
    await acceptCategorySuggestion('suggestion-2', 'category-2')

    expect(api.post).toHaveBeenNthCalledWith(1, '/categorization/suggestion-1/accept', {})
    expect(api.post).toHaveBeenNthCalledWith(2, '/categorization/suggestion-2/accept', { categoryId: 'category-2' })
  })

  it('dismisses a suggestion without assigning a category', async () => {
    api.post.mockResolvedValue({ data: { success: true } })

    await rejectCategorySuggestion('suggestion-1')

    expect(api.post).toHaveBeenCalledWith('/categorization/suggestion-1/reject', {})
  })
})
