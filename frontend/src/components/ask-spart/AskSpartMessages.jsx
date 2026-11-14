import { Bot, LoaderCircle, RefreshCw, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button.jsx'

function AskSpartMessages({ messages, sending, failedMessage, failedError, onRetry, loading, truncated }) {
  if (loading) {
    return <div aria-busy="true" className="flex flex-1 items-center justify-center text-sm text-muted-foreground" role="status">Loading this conversation…</div>
  }

  return (
    <div aria-label="Chat messages" aria-live="polite" className="flex-1 space-y-4 overflow-y-auto px-3 py-5 sm:px-5">
      {truncated && (
        <p className="mx-auto max-w-lg rounded-xl border border-border/70 bg-background/40 p-3 text-center text-xs text-muted-foreground">
          Showing the most recent messages in this chat. Older messages are not available in the current history response.
        </p>
      )}
      {messages.map((message, index) => {
        const isUser = message.role === 'user'
        return (
          <article className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`} key={message.id ?? message._id ?? `${message.role}-${index}`}>
            {!isUser && (
              <span className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/25 to-sky-400/20 text-primary">
                <Bot aria-hidden="true" className="size-4" />
              </span>
            )}
            <div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed sm:max-w-[78%] ${isUser ? 'rounded-br-md bg-primary text-primary-foreground' : 'glass-flat rounded-bl-md'}`}>
              <p className="whitespace-pre-wrap break-words">{message.content}</p>
              {!isUser && message.answerSource === 'verified_data_fallback' && (
                <p className="mt-2 border-t border-border/50 pt-2 text-xs text-muted-foreground">
                  AI is temporarily unavailable; this answer uses verified data instead.
                </p>
              )}
            </div>
            {isUser && (
              <span className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-xl bg-sky-400/10 text-sky-300">
                <UserRound aria-hidden="true" className="size-4" />
              </span>
            )}
          </article>
        )
      })}
      {failedMessage && (
        <article className="flex justify-end gap-2.5">
          <div className="max-w-[88%] rounded-2xl rounded-br-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm sm:max-w-[78%]">
            <p className="whitespace-pre-wrap break-words">{failedMessage}</p>
            {failedError && (
              <div className="mt-2 space-y-1">
                <p className="text-xs text-destructive" role="alert">{failedError}</p>
                <p className="text-[11px] text-muted-foreground">Retry resends the question; a timed-out request may already have reached the server.</p>
              </div>
            )}
            <Button className="mt-2" onClick={onRetry} size="sm" type="button" variant="outline">
              <RefreshCw aria-hidden="true" />Retry message
            </Button>
          </div>
          <span className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-xl bg-sky-400/10 text-sky-300">
            <UserRound aria-hidden="true" className="size-4" />
          </span>
        </article>
      )}
      {sending && (
        <div className="flex items-center gap-2 pl-10 text-xs text-muted-foreground" role="status">
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          Spart is reviewing your question…
        </div>
      )}
    </div>
  )
}

export default AskSpartMessages
