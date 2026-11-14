import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from './api.js'
import {
  deleteAskSpartConversation,
  getAskSpartConversation,
  getAskSpartHealth,
  listAskSpartConversations,
  sendAskSpartMessage,
} from './askSpartApi.js'

vi.mock('./api.js', () => ({ default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }))

describe('Ask Spart API', () => {
  beforeEach(() => vi.clearAllMocks())

  it('uses the supported paginated conversation and health endpoints', async () => {
    api.get
      .mockResolvedValueOnce({ data: { data: [{ _id: 'chat-1' }], pagination: { page: 1, pages: 1 } } })
      .mockResolvedValueOnce({ data: { data: { _id: 'chat-1', messages: [] } } })
      .mockResolvedValueOnce({ data: { data: { assistant: 'Spart', status: 'rules_only' } } })

    await expect(listAskSpartConversations({ page: 1, limit: 50, status: 'active' }))
      .resolves.toEqual({ conversations: [{ _id: 'chat-1' }], pagination: { page: 1, pages: 1 } })
    await expect(getAskSpartConversation('chat-1')).resolves.toMatchObject({ _id: 'chat-1' })
    await expect(getAskSpartHealth()).resolves.toMatchObject({ assistant: 'Spart', status: 'rules_only' })

    expect(api.get).toHaveBeenNthCalledWith(1, '/ask-spart/conversations', { params: { page: 1, limit: 50, status: 'active' } })
    expect(api.get).toHaveBeenNthCalledWith(2, '/ask-spart/conversations/chat-1')
    expect(api.get).toHaveBeenNthCalledWith(3, '/ask-spart/health')
  })

  it('sends only the existing chat payload and deletes conversations through the supported endpoint', async () => {
    const result = { conversationId: 'chat-1', message: 'Verified response', answerSource: 'verified_data' }
    api.post.mockResolvedValue({ data: { data: result } })
    api.delete.mockResolvedValue({ data: { data: { id: 'chat-1', deleted: true } } })

    await expect(sendAskSpartMessage({ message: 'How much did I spend?' })).resolves.toEqual(result)
    await expect(deleteAskSpartConversation('chat-1')).resolves.toEqual({ id: 'chat-1', deleted: true })

    expect(api.post).toHaveBeenCalledWith('/ask-spart/chat', { message: 'How much did I spend?' })
    expect(api.delete).toHaveBeenCalledWith('/ask-spart/conversations/chat-1')
  })
})
