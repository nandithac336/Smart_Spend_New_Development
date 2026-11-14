import { ChevronLeft, ChevronRight, LoaderCircle, ListChecks } from 'lucide-react'
import EmptyState from '@/components/common/EmptyState.jsx'
import ErrorState from '@/components/common/ErrorState.jsx'
import { Button } from '@/components/ui/button.jsx'
import StatementDraftRow from './StatementDraftRow.jsx'

function StatementDraftList({ record, drafts, pagination, page, setPage, loading, error, retry, categories, timeZone, selectedIds, select, save, skip, busy, editable }) {
  if (loading) return <div aria-busy="true" className="glass-flat flex min-h-40 items-center justify-center gap-2 rounded-2xl text-sm text-muted-foreground"><LoaderCircle aria-hidden="true" className="size-4 animate-spin" />Loading statement rows…</div>
  if (error) return <ErrorState onRetry={retry} title="Couldn’t load transaction preview" />
  if (!drafts.length) return <EmptyState description={record.errorDetails?.message || 'No transaction rows were returned for this statement.'} title={record.status === 'failed' ? 'Statement needs attention' : 'No transaction rows'} />
  const pages = pagination?.pages ?? 1
  const first = (page - 1) * (pagination?.limit ?? 100) + 1
  const last = Math.min(page * (pagination?.limit ?? 100), pagination?.total ?? drafts.length)
  return (
    <section aria-label="Statement transaction preview" className="space-y-3">
      <header className="glass-flat flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 className="flex items-center gap-2 text-sm font-semibold"><ListChecks aria-hidden="true" className="size-4 text-primary" />Review extracted transactions</h2><p className="mt-1 text-xs text-muted-foreground">{pagination?.total ?? drafts.length} rows · showing {first}–{last}. Upload only created review drafts.</p></div>
        <span aria-live="polite" className="text-sm font-medium">{selectedIds.size} selected</span>
      </header>
      <div className="space-y-3">
        {drafts.map((draft) => {
          const id = String(draft._id ?? draft.id)
          return <StatementDraftRow busy={busy} categories={categories} draft={draft} editable={editable} key={id} onSave={save} onSelect={select} onSkip={skip} selected={selectedIds.has(id)} timeZone={timeZone} />
        })}
      </div>
      {pages > 1 && <div className="flex items-center justify-between gap-3"><Button disabled={page <= 1} onClick={() => setPage(page - 1)} type="button" variant="outline"><ChevronLeft aria-hidden="true" />Previous</Button><span className="text-xs text-muted-foreground">Page {page} of {pages}</span><Button disabled={page >= pages} onClick={() => setPage(page + 1)} type="button" variant="outline">Next<ChevronRight aria-hidden="true" /></Button></div>}
    </section>
  )
}

export default StatementDraftList
