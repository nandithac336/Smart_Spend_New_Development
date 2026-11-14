import { useState } from 'react'
import { CircleAlert, Plus, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import AskSpartChatPanel from '@/components/ask-spart/AskSpartChatPanel.jsx'
import AskSpartConversationList from '@/components/ask-spart/AskSpartConversationList.jsx'
import PageHeader from '@/components/common/PageHeader.jsx'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog.jsx'
import { Button } from '@/components/ui/button.jsx'
import { useAskSpartConversation, useAskSpartConversations, useAskSpartHealth, useAskSpartMutations } from '@/hooks/useAskSpart.js'
import { getErrorMessage } from '@/lib/errors.js'
import { useQueryClient } from '@tanstack/react-query'

function AskSpart() {
  const [selectedId, setSelectedId] = useState('')
  const [message, setMessage] = useState('')
  const [pendingMessage, setPendingMessage] = useState('')
  const [failedMessage, setFailedMessage] = useState('')
  const [sendError, setSendError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteError, setDeleteError] = useState('')
  const client = useQueryClient()
  const conversationsQuery = useAskSpartConversations()
  const conversationQuery = useAskSpartConversation(selectedId)
  const healthQuery = useAskSpartHealth()
  const mutations = useAskSpartMutations()
  const conversations = conversationsQuery.data?.pages.flatMap((page) => page.conversations) ?? []
  const chatMessages = conversationQuery.data?.messages ?? []
  const sending = mutations.send.isPending
  const deleting = mutations.remove.isPending
  const historyLoading = Boolean(selectedId) && conversationQuery.isLoading

  function startNewChat() {
    if (sending || deleting) return
    setSelectedId('')
    setMessage('')
    setPendingMessage('')
    setFailedMessage('')
    setSendError('')
  }

  async function sendQuestion(text = message) {
    const trimmed = text.trim()
    if (!trimmed || trimmed.length > 2000 || sending || historyLoading || (selectedId && conversationQuery.isError && !conversationQuery.data)) return
    setPendingMessage(trimmed)
    setSendError('')
    setFailedMessage('')
    setMessage('')
    try {
      const result = await mutations.send.mutateAsync({
        ...(selectedId ? { conversationId: selectedId } : {}),
        message: trimmed,
      })
      const conversationId = String(result.conversationId)
      const key = ['ask-spart', 'conversation', conversationId]
      const existing = client.getQueryData(key)
      const userMessage = {
        id: `local-user-${Date.now()}`,
        role: 'user',
        content: trimmed,
        createdAt: new Date().toISOString(),
      }
      const assistantMessage = {
        ...result.assistantMessage,
        answerSource: result.answerSource,
      }
      client.setQueryData(key, {
        ...(existing ?? {}),
        _id: conversationId,
        title: existing?.title ?? trimmed.slice(0, 77),
        status: 'active',
        messages: [...(existing?.messages ?? []), userMessage, assistantMessage],
        messageCount: (existing?.messageCount ?? 0) + 2,
      })
      setSelectedId(conversationId)
      setPendingMessage('')
    } catch (error) {
      setPendingMessage('')
      setFailedMessage(trimmed)
      setSendError(getErrorMessage(error, 'Spart couldn’t answer just now. Please try again.'))
    }
  }

  async function deleteConversation() {
    if (!deleteTarget) return
    const id = String(deleteTarget._id)
    setDeleteError('')
    try {
      await mutations.remove.mutateAsync(id)
      if (selectedId === id) startNewChat()
      setDeleteTarget(null)
      toast.success('Conversation deleted')
    } catch (error) {
      setDeleteError(getErrorMessage(error, 'Could not delete this conversation.'))
    }
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        action={(
          <Button disabled={sending || deleting} onClick={startNewChat} type="button" variant="outline">
            <Plus aria-hidden="true" />New chat
          </Button>
        )}
        description="Ask questions about your spending, budgets, goals and upcoming payments."
        eyebrow="Your read-only finance assistant"
        title="Ask Spart"
      />
      <div className="flex items-start gap-2 rounded-xl border border-primary/15 bg-primary/5 p-3 text-xs leading-relaxed text-muted-foreground">
        <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
        Spart answers from your verified financial records and cannot change transactions, wallets or budgets. Never share passwords or banking credentials in chat.
      </div>
      {healthQuery.data?.status === 'rules_only' && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 text-sm text-amber-100" role="status">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          AI responses are unavailable. Spart will continue with the verified-data assistant and deterministic answers.
        </div>
      )}
      {healthQuery.isError && (
        <p className="text-xs text-muted-foreground" role="status">Assistant availability couldn’t be checked. You can still try a question.</p>
      )}
      <div className="grid gap-4 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <AskSpartConversationList
          busy={sending || deleting}
          conversations={conversations}
          error={conversationsQuery.isError}
          loading={conversationsQuery.isLoading}
          onDelete={setDeleteTarget}
          onLoadMore={() => conversationsQuery.fetchNextPage()}
          onNew={startNewChat}
          onRetry={() => conversationsQuery.refetch()}
          onSelect={(id) => {
            setSelectedId(id)
            setMessage('')
            setPendingMessage('')
            setFailedMessage('')
            setSendError('')
          }}
          pagination={conversationsQuery.data?.pages.at(-1)?.pagination}
          selectedId={selectedId}
        />
        <AskSpartChatPanel
          deleting={deleting}
          failedError={sendError}
          failedMessage={failedMessage}
          isError={conversationQuery.isError}
          loading={historyLoading}
          message={message}
          messages={chatMessages}
          onDelete={() => setDeleteTarget(conversations.find((item) => String(item._id) === selectedId) ?? { _id: selectedId, title: 'conversation' })}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              event.currentTarget.form?.requestSubmit()
            }
          }}
          onMessageChange={(event) => setMessage(event.target.value)}
          onRetryHistory={() => conversationQuery.refetch()}
          onRetryMessage={() => sendQuestion(failedMessage)}
          onSubmit={(event) => {
            event.preventDefault()
            sendQuestion()
          }}
          onSuggestedQuestion={sendQuestion}
          pendingMessage={pendingMessage}
          selectedId={selectedId}
          sending={sending}
          title={conversationQuery.data?.title}
          truncated={conversationQuery.data?.messagesTruncated}
        />
      </div>
      <AlertDialog onOpenChange={(open) => { if (!open && !deleting) { setDeleteTarget(null); setDeleteError('') } }} open={Boolean(deleteTarget)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes “{deleteTarget?.title || 'conversation'}” and its messages from your chat history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && <p className="text-sm text-destructive" role="alert">{deleteError}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={deleting} onClick={(event) => { event.preventDefault(); deleteConversation() }} variant="destructive">
              {deleting ? 'Deleting…' : 'Delete conversation'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default AskSpart
