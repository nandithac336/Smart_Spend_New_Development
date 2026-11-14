import { MessageSquare, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button.jsx'

function AskSpartConversationList({
  conversations,
  pagination,
  selectedId,
  loading,
  error,
  onSelect,
  onNew,
  onDelete,
  onLoadMore,
  onRetry,
  busy,
}) {
  return (
    <aside aria-label="Conversation history" className="glass-flat flex min-h-0 flex-col rounded-2xl p-3 sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Your conversations</h2>
        <Button aria-label="Start a new chat" disabled={busy} onClick={onNew} size="icon" type="button" variant="outline">
          <Plus aria-hidden="true" />
        </Button>
      </div>
      {loading ? (
        <p className="mt-4 text-xs text-muted-foreground" role="status">Loading conversations…</p>
      ) : error ? (
        <div className="mt-4 space-y-2 text-xs text-destructive" role="alert">
          <p>Couldn’t load your conversation history.</p>
          <Button onClick={onRetry} size="sm" type="button" variant="outline">Retry</Button>
        </div>
      ) : conversations.length === 0 ? (
        <div className="mt-5 flex flex-col items-center rounded-xl border border-dashed border-border/70 px-4 py-6 text-center">
          <MessageSquare aria-hidden="true" className="size-5 text-muted-foreground" />
          <p className="mt-2 text-xs text-muted-foreground">Your saved chats will appear here.</p>
        </div>
      ) : (
        <ul className="mt-3 max-h-56 space-y-1 overflow-y-auto sm:max-h-[min(60vh,38rem)]">
          {conversations.map((conversation) => {
            const id = String(conversation._id)
            return (
              <li key={id}>
                <div className={`group flex items-center gap-1 rounded-xl ${id === selectedId ? 'bg-primary/10 text-primary' : 'hover:bg-background/50'}`}>
                  <button
                    className="min-w-0 flex-1 px-3 py-2.5 text-left text-xs"
                    disabled={busy}
                    onClick={() => onSelect(id)}
                    type="button"
                  >
                    <span className="block truncate font-medium">{conversation.title || 'New conversation'}</span>
                    <span className="mt-1 block truncate text-[11px] text-muted-foreground">
                      {conversation.lastMessage?.content || 'No messages'}
                    </span>
                  </button>
                  <Button
                    aria-label={`Delete ${conversation.title || 'conversation'}`}
                    className="mr-1 size-8 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                    disabled={busy}
                    onClick={() => onDelete(conversation)}
                    size="icon"
                    type="button"
                    variant="ghost"
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {pagination?.page < pagination?.pages && (
        <Button className="mt-3 w-full" disabled={loading || busy} onClick={onLoadMore} type="button" variant="outline">
          Load older conversations
        </Button>
      )}
    </aside>
  )
}

export default AskSpartConversationList
