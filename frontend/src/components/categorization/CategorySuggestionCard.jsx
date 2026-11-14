import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, CircleAlert, LoaderCircle, Sparkles, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button.jsx'
import { getTransaction } from '@/services/transactionApi.js'
import { getErrorMessage } from '@/lib/errors.js'
import { formatTxnDate } from '@/lib/dates.js'
import { formatINR } from '@/lib/money.js'

const sourceNames = {
  ai: 'AI suggestion',
  history: 'Your transaction history',
  user_rule: 'Your merchant preference',
  keyword_rule: 'Merchant match',
  none: 'No confident match',
}

function categoryId(value) {
  return value?._id ?? value?.id ?? value ?? ''
}

function CategorySuggestionCard({ suggestion, categories, busy, canAccept, timeZone, onAccept, onReject }) {
  const [selectedCategoryId, setSelectedCategoryId] = useState(String(categoryId(suggestion.suggestedCategoryId)))
  const [actionError, setActionError] = useState('')
  const transactionId = String(suggestion.transactionId?._id ?? suggestion.transactionId)
  const transactionQuery = useQuery({
    queryKey: ['transactions', 'categorization-review', transactionId],
    queryFn: () => getTransaction(transactionId),
  })
  const transaction = transactionQuery.data
  const currentCategory = transaction?.categoryId
  const currentCategoryId = String(categoryId(currentCategory))
  const type = suggestion.transactionType
  const availableCategories = categories.filter((category) => category.type === type)
  const selectedCategory = availableCategories.find((category) => String(categoryId(category)) === selectedCategoryId)
  const suggestedCategoryName = suggestion.suggestedCategoryId?.name
  const confidence = Number.isFinite(suggestion.confidence) ? suggestion.confidence : null
  const alternatives = suggestion.alternatives ?? []
  const canReview = !transactionQuery.isLoading && !transactionQuery.isError && Boolean(transaction)
  const preserveExistingCategory = Boolean(currentCategoryId)

  async function accept() {
    if (!canAccept || !selectedCategoryId || !selectedCategory || preserveExistingCategory) return
    setActionError('')
    try {
      const useSuggested = selectedCategoryId === String(categoryId(suggestion.suggestedCategoryId))
      await onAccept(suggestion, useSuggested ? undefined : selectedCategoryId)
      toast.success(useSuggested ? 'Category suggestion accepted' : `Category set to ${selectedCategory?.name}`)
    } catch (error) {
      setActionError(getErrorMessage(error, 'Could not accept this category.'))
    }
  }

  async function reject() {
    setActionError('')
    try {
      await onReject(suggestion)
      toast.success('Suggestion rejected')
    } catch (error) {
      setActionError(getErrorMessage(error, 'Could not dismiss this suggestion.'))
    }
  }

  return (
    <article className="glass-flat space-y-4 rounded-2xl p-4 sm:p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Sparkles aria-hidden="true" className="size-4 text-primary" />
            <h2 className="truncate text-sm font-semibold">{suggestion.detectedMerchant || transaction?.merchant || 'Transaction'}</h2>
          </div>
          <p className="mt-1 text-xs capitalize text-muted-foreground">
            {type} transaction
            {transaction?.amount != null ? ` · ${formatINR(Math.abs(transaction.amount))}` : ''}
            {transaction?.txnDate ? ` · ${formatTxnDate(transaction.txnDate, { timeZone })}` : ''}
          </p>
        </div>
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
          {sourceNames[suggestion.source] ?? 'Category suggestion'}
        </span>
      </header>

      {transactionQuery.isLoading && <p className="text-xs text-muted-foreground" role="status">Loading transaction details…</p>}
      {transactionQuery.isError && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive" role="alert">
          Couldn’t load transaction details. Review is disabled to protect its existing category.
          <Button onClick={() => transactionQuery.refetch()} size="sm" type="button" variant="outline">Retry</Button>
        </div>
      )}
      {transaction && (
        <div className="space-y-2 rounded-xl border border-border/70 bg-background/35 p-3">
          <p className="text-sm">{transaction.note || transaction.merchant || 'No description provided'}</p>
          {preserveExistingCategory && (
            <p className="flex items-center gap-2 text-xs text-amber-200" role="status">
              <CircleAlert aria-hidden="true" className="size-4" />
              Existing category “{currentCategory?.name || 'assigned'}” is protected. Accepting won’t overwrite it; dismiss this stale suggestion instead.
            </p>
          )}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-primary/15 bg-primary/5 p-3">
          <p className="text-xs text-muted-foreground">Suggested category</p>
          <p className="mt-1 text-sm font-semibold">
            {suggestedCategoryName || availableCategories.find((category) => String(categoryId(category)) === String(categoryId(suggestion.suggestedCategoryId)))?.name || 'No confident suggestion'}
          </p>
          {confidence !== null && (
            <p className="mt-1 text-xs text-muted-foreground">
              {Math.round(confidence * 100)}% confidence · {suggestion.confidenceLevel} confidence
            </p>
          )}
          {suggestion.explanation && <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{suggestion.explanation}</p>}
        </div>
        {alternatives.length > 0 && (
          <div className="rounded-xl border border-border/70 p-3">
            <p className="text-xs font-medium text-muted-foreground">Other suggestions</p>
            <ul className="mt-2 space-y-1.5">
              {alternatives.map((alternative) => {
                const id = String(categoryId(alternative.categoryId))
                const category = availableCategories.find((item) => String(categoryId(item)) === id)
                return (
                  <li className="flex items-center justify-between gap-2 text-xs" key={id}>
                    <span>{category?.name || 'Alternative category'}</span>
                    {Number.isFinite(alternative.confidence) && <span className="text-muted-foreground">{Math.round(alternative.confidence * 100)}%</span>}
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>

      {canReview && !preserveExistingCategory && (
        <div className="space-y-3 border-t border-border/70 pt-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium" htmlFor={`suggestion-category-${suggestion._id}`}>Choose a category manually</label>
            <select
              className="h-10 w-full rounded-xl border border-input bg-background/45 px-3 text-sm"
              id={`suggestion-category-${suggestion._id}`}
              onChange={(event) => setSelectedCategoryId(event.target.value)}
              value={selectedCategoryId}
            >
              <option value="">Select a category</option>
              {availableCategories.map((category) => (
                <option key={categoryId(category)} value={categoryId(category)}>
                  {category.icon ? `${category.icon} ` : ''}{category.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy || !canAccept || !selectedCategoryId || !selectedCategory} onClick={accept} type="button">
              {busy ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Check aria-hidden="true" />}
              {selectedCategoryId === String(categoryId(suggestion.suggestedCategoryId)) && suggestion.suggestedCategoryId
                ? 'Accept suggestion'
                : 'Use selected category'}
            </Button>
            <Button disabled={busy} onClick={reject} type="button" variant="outline">
              <X aria-hidden="true" />Reject suggestion
            </Button>
          </div>
        </div>
      )}
      {canReview && preserveExistingCategory && (
        <Button disabled={busy} onClick={reject} type="button" variant="outline"><X aria-hidden="true" />Dismiss stale suggestion</Button>
      )}
      {actionError && <p className="text-sm text-destructive" role="alert">{actionError}</p>}
    </article>
  )
}

export default CategorySuggestionCard
