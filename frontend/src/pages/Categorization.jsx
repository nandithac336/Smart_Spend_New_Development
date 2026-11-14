import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import EmptyState from '@/components/common/EmptyState.jsx'
import ErrorState from '@/components/common/ErrorState.jsx'
import PageHeader from '@/components/common/PageHeader.jsx'
import CategorySuggestionCard from '@/components/categorization/CategorySuggestionCard.jsx'
import { Button } from '@/components/ui/button.jsx'
import { useAuth } from '@/hooks/useAuth.js'
import { useCategories } from '@/hooks/useCategories.js'
import { useCategorySuggestions } from '@/hooks/useCategorySuggestions.js'
import { useCategorizationMutations } from '@/hooks/useCategorizationMutations.js'

function Categorization() {
  const [page, setPage] = useState(1)
  const { user } = useAuth()
  const suggestionsQuery = useCategorySuggestions(page)
  const categoriesQuery = useCategories()
  const mutations = useCategorizationMutations()
  const suggestions = suggestionsQuery.data?.suggestions ?? []
  const categories = categoriesQuery.data ?? []
  const pagination = suggestionsQuery.data?.pagination
  const busy = mutations.accept.isPending || mutations.reject.isPending

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        description="Review suggestions from AI, your merchant rules, transaction history, and built-in matching. Nothing changes until you choose a category."
        eyebrow="Review before applying"
        title="Transaction Categorization"
      />
      {categoriesQuery.isError && (
        <ErrorState onRetry={() => categoriesQuery.refetch()} title="Couldn’t load categories" description="Suggestions are visible, but accepting them is disabled until available categories can be loaded." />
      )}
      {suggestionsQuery.isLoading ? (
        <div aria-busy="true" className="grid gap-3">
          {[0, 1, 2].map((item) => <div className="glass-flat h-48 animate-pulse rounded-2xl" key={item} />)}
        </div>
      ) : suggestionsQuery.isError ? (
        <ErrorState onRetry={() => suggestionsQuery.refetch()} title="Couldn’t load category suggestions" />
      ) : suggestions.length === 0 ? (
        <EmptyState
          description="New uncategorized transactions are checked automatically. If no confident match is found, the suggestion will ask you to select a category manually."
          title="You’re all caught up"
        />
      ) : (
        <>
          <div className="space-y-3">
            {suggestions.map((suggestion) => (
              <CategorySuggestionCard
                busy={busy}
                canAccept={categoriesQuery.isSuccess}
                categories={categories}
                key={suggestion._id}
                onAccept={(item, categoryId) => mutations.accept.mutateAsync({ id: item._id, categoryId })}
                onReject={(item) => mutations.reject.mutateAsync(item._id)}
                suggestion={suggestion}
                timeZone={user?.timezone || 'Asia/Kolkata'}
              />
            ))}
          </div>
          {pagination?.pages > 1 && (
            <div className="flex items-center justify-between gap-3">
              <Button disabled={page <= 1} onClick={() => setPage((current) => current - 1)} type="button" variant="outline"><ChevronLeft aria-hidden="true" />Previous</Button>
              <span className="text-xs text-muted-foreground">Page {pagination.page} of {pagination.pages}</span>
              <Button disabled={page >= pagination.pages} onClick={() => setPage((current) => current + 1)} type="button" variant="outline">Next<ChevronRight aria-hidden="true" /></Button>
            </div>
          )}
        </>
      )}
      <p className="rounded-xl border border-border/70 bg-background/30 p-3 text-xs leading-relaxed text-muted-foreground">
        Accepting a suggestion assigns the category to the saved transaction. Choosing a different category can also update your merchant preference. Existing transaction categories are never overwritten here.
      </p>
    </div>
  )
}

export default Categorization
