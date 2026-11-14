import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AskSpart from './AskSpart.jsx'
import {
  deleteAskSpartConversation,
  getAskSpartConversation,
  getAskSpartHealth,
  listAskSpartConversations,
  sendAskSpartMessage,
} from '@/services/askSpartApi.js'

vi.mock('@/services/askSpartApi.js', () => ({
  deleteAskSpartConversation: vi.fn(),
  getAskSpartConversation: vi.fn(),
  getAskSpartHealth: vi.fn(),
  listAskSpartConversations: vi.fn(),
  sendAskSpartMessage: vi.fn(),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const conversations = []
const page = { conversations, pagination: { page: 1, limit: 50, total: 0, pages: 0 } }

function renderAskSpart() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <AskSpart />
    </QueryClientProvider>,
  )
  return queryClient
}

describe('Ask Spart page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listAskSpartConversations.mockResolvedValue(page)
    getAskSpartHealth.mockResolvedValue({ assistant: 'Spart', status: 'ai_enabled' })
    getAskSpartConversation.mockResolvedValue({
      _id: 'conversation-1',
      title: 'Monthly spending',
      messages: [
        { id: 'user-1', role: 'user', content: 'How much did I spend this month?' },
        { id: 'assistant-1', role: 'assistant', content: 'Your verified spending is ₹250.' },
      ],
      messageCount: 2,
      messagesTruncated: false,
    })
    sendAskSpartMessage.mockResolvedValue({
      conversationId: 'conversation-1',
      message: 'Your verified spending is ₹250.',
      answerSource: 'verified_data',
      assistantMessage: { id: 'assistant-1', role: 'assistant', content: 'Your verified spending is ₹250.' },
    })
    deleteAskSpartConversation.mockResolvedValue({ id: 'conversation-1', deleted: true })
  })
  afterEach(cleanup)

  it('renders the empty conversation state and starter prompts', async () => {
    renderAskSpart()

    expect(await screen.findByText('Your money, made clearer')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'How much did I spend this month?' })).toBeInTheDocument()
    expect(screen.getByText(/cannot change transactions, wallets or budgets/)).toBeInTheDocument()
  })

  it('prevents empty submission and displays a verified response to a sent question', async () => {
    renderAskSpart()
    const send = screen.getByRole('button', { name: 'Send message' })
    expect(send).toBeDisabled()
    fireEvent.change(screen.getByRole('textbox', { name: 'Message Spart' }), {
      target: { value: '  How much did I spend?  ' },
    })
    fireEvent.click(send)

    expect(await screen.findByText('Your verified spending is ₹250.')).toBeInTheDocument()
    expect(sendAskSpartMessage).toHaveBeenCalledWith(
      { message: 'How much did I spend?' },
      expect.objectContaining({ client: expect.any(QueryClient) }),
    )
  })

  it('shows sending state while the assistant response is pending', async () => {
    let resolveSend
    sendAskSpartMessage.mockReturnValueOnce(new Promise((resolve) => { resolveSend = resolve }))
    renderAskSpart()
    fireEvent.click(await screen.findByRole('button', { name: 'How much did I spend this month?' }))

    expect(await screen.findByText('Spart is reviewing your question…')).toBeInTheDocument()
    resolveSend({
      conversationId: 'conversation-1',
      answerSource: 'verified_data',
      assistantMessage: { id: 'assistant-1', role: 'assistant', content: 'Your verified spending is ₹250.' },
    })
    expect(await screen.findByText('Your verified spending is ₹250.')).toBeInTheDocument()
  })

  it('shows the backend deterministic fallback and supports retry after a request error', async () => {
    sendAskSpartMessage
      .mockRejectedValueOnce({ response: { status: 503, data: { error: { message: 'Assistant temporarily unavailable' } } } })
      .mockResolvedValueOnce({
        conversationId: 'conversation-1',
        answerSource: 'verified_data_fallback',
        assistantMessage: { id: 'assistant-2', role: 'assistant', content: 'Verified data says ₹250.' },
      })
    renderAskSpart()
    fireEvent.click(await screen.findByRole('button', { name: 'How much did I spend this month?' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Assistant temporarily unavailable')
    expect(screen.getByText(/Retry resends the question/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retry message' }))

    expect(await screen.findByText('Verified data says ₹250.')).toBeInTheDocument()
    expect(screen.getByText(/AI is temporarily unavailable; this answer uses verified data instead/)).toBeInTheDocument()
    expect(sendAskSpartMessage).toHaveBeenCalledTimes(2)
  })

  it('loads prior conversation history and deletes it using the supported action', async () => {
    listAskSpartConversations.mockResolvedValue({
      conversations: [{ _id: 'conversation-1', title: 'Monthly spending', lastMessage: { content: 'Your verified spending is ₹250.' } }],
      pagination: { page: 1, limit: 50, total: 1, pages: 1 },
    })
    renderAskSpart()
    fireEvent.click((await screen.findAllByRole('button', { name: /Monthly spending/ }))[0])

    expect(await screen.findByText('How much did I spend this month?')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Delete current conversation' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete conversation' }))

    await waitFor(() => expect(deleteAskSpartConversation).toHaveBeenCalledWith(
      'conversation-1',
      expect.objectContaining({ client: expect.any(QueryClient) }),
    ))
    expect(await screen.findByText('Your money, made clearer')).toBeInTheDocument()
  })

  it('provides retry when conversation history fails to load', async () => {
    listAskSpartConversations.mockRejectedValueOnce(new Error('network failure'))
    renderAskSpart()

    expect(await screen.findByRole('alert')).toHaveTextContent('Couldn’t load your conversation history.')
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(listAskSpartConversations).toHaveBeenCalledTimes(2))
  })

  it('reports an assistant provider in deterministic mode without blocking chat', async () => {
    getAskSpartHealth.mockResolvedValue({ assistant: 'Spart', status: 'rules_only' })
    renderAskSpart()

    expect(await screen.findByText(/AI responses are unavailable/)).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Message Spart' })).toBeEnabled()
  })
})
