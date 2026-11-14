import { Bot, LoaderCircle, Send, Trash2 } from 'lucide-react'
import AskSpartMessages from '@/components/ask-spart/AskSpartMessages.jsx'
import EmptyState from '@/components/common/EmptyState.jsx'
import ErrorState from '@/components/common/ErrorState.jsx'
import { Button } from '@/components/ui/button.jsx'
import { Textarea } from '@/components/ui/textarea.jsx'

const suggestedQuestions = [
  'How much did I spend this month?',
  'How are my budgets doing?',
  'What payments are coming up?',
  'How much have I saved toward my goals?',
]

function AskSpartChatPanel({
  selectedId,
  title,
  loading,
  isError,
  onRetryHistory,
  messages,
  failedMessage,
  failedError,
  pendingMessage,
  sending,
  onRetryMessage,
  onDelete,
  deleting,
  message,
  onMessageChange,
  onKeyDown,
  onSubmit,
  onSuggestedQuestion,
  truncated,
}) {
  const isEmpty = !selectedId && !messages.length && !failedMessage && !pendingMessage

  return (
    <section aria-label="Ask Spart chat" className="glass-flat flex min-h-[min(72vh,48rem)] min-w-0 flex-col overflow-hidden rounded-2xl">
      <header className="flex items-center gap-3 border-b border-border/70 px-4 py-3 sm:px-5">
        <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary/25 to-sky-400/20 text-primary">
          <Bot aria-hidden="true" className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">Spart</h2>
          <p className="text-xs text-muted-foreground">{selectedId ? title || 'Your conversation' : 'Ask about your finances'}</p>
        </div>
        {selectedId && (
          <Button
            aria-label="Delete current conversation"
            className="ml-auto"
            disabled={sending || deleting}
            onClick={onDelete}
            size="icon"
            type="button"
            variant="ghost"
          >
            <Trash2 aria-hidden="true" />
          </Button>
        )}
      </header>
      {selectedId && isError && !messages.length ? (
        <div className="flex flex-1 items-center justify-center p-4">
          <ErrorState onRetry={onRetryHistory} title="Couldn’t load this conversation" />
        </div>
      ) : isEmpty ? (
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-8">
          <EmptyState
            className="min-h-0 border-0 bg-transparent shadow-none"
            description="Ask a question to get started. Spart uses only your own confirmed financial data and may explain when it can’t answer."
            icon={Bot}
            title="Your money, made clearer"
          />
          <div className="mt-4 flex max-w-2xl flex-wrap justify-center gap-2">
            {suggestedQuestions.map((question) => (
              <Button disabled={sending} key={question} onClick={() => onSuggestedQuestion(question)} type="button" variant="outline">
                {question}
              </Button>
            ))}
          </div>
        </div>
      ) : (
        <AskSpartMessages
          failedError={failedError}
          failedMessage={failedMessage}
          loading={loading}
          messages={messages}
          onRetry={onRetryMessage}
          sending={sending}
          truncated={truncated}
        />
      )}
      {pendingMessage && (
        <div className="border-t border-border/50 px-4 py-2 text-xs text-muted-foreground" role="status">
          Sending: {pendingMessage}
        </div>
      )}
      <form className="border-t border-border/70 bg-background/25 p-3 sm:p-4" onSubmit={onSubmit}>
        <label className="sr-only" htmlFor="ask-spart-message">Message Spart</label>
        <div className="flex items-end gap-2">
          <Textarea
            aria-describedby="ask-spart-input-help"
            className="max-h-40 min-h-12 resize-y rounded-xl bg-background/50 text-sm"
            disabled={sending || loading || (isError && !messages.length)}
            id="ask-spart-message"
            maxLength={2000}
            onChange={onMessageChange}
            onKeyDown={onKeyDown}
            placeholder="Ask about your spending, budgets, or goals…"
            value={message}
          />
          <Button aria-label="Send message" disabled={sending || loading || (isError && !messages.length) || !message.trim()} size="icon" type="submit">
            {sending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Send aria-hidden="true" />}
          </Button>
        </div>
        <p className="mt-2 px-1 text-[11px] text-muted-foreground" id="ask-spart-input-help">
          Press Enter to send · Shift + Enter for a new line · {message.length}/2000
        </p>
      </form>
    </section>
  )
}

export default AskSpartChatPanel
