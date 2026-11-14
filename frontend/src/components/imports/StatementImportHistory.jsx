import { Check, Clock3, FileSpreadsheet, TriangleAlert } from 'lucide-react'
import { formatTxnDate } from '@/lib/dates.js'
import ErrorState from '@/components/common/ErrorState.jsx'

const labels = { processing: 'Processing', review: 'Ready to review', partially_imported: 'Partially imported', completed: 'Completed', failed: 'Failed' }

function StatementImportHistory({ imports, selectedId, loading, error, retry, select, timeZone }) {
  return (
    <section aria-label="Previous statement imports" className="space-y-3">
      <div><h2 className="text-base font-semibold">Recent imports</h2><p className="mt-1 text-xs text-muted-foreground">Select an import to continue reviewing saved rows.</p></div>
      {error ? <ErrorState onRetry={retry} title="Couldn’t load recent imports" /> : loading ? <div aria-busy="true" className="glass-flat h-20 animate-pulse rounded-2xl" /> : !imports.length ? <div className="glass-flat rounded-2xl px-4 py-6 text-center text-sm text-muted-foreground">No statement imports yet.</div> : (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {imports.map((record) => {
            const id = String(record._id ?? record.id)
            const Icon = record.status === 'completed' ? Check : record.status === 'failed' ? TriangleAlert : Clock3
            return <button aria-pressed={selectedId === id} className={`flex min-w-0 items-start gap-3 rounded-xl border p-3 text-left ${selectedId === id ? 'border-primary/40 bg-primary/5' : 'border-border/70 bg-background/30 hover:bg-accent/40'}`} key={id} onClick={() => select(record)} type="button"><span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent/70 text-primary"><FileSpreadsheet aria-hidden="true" className="size-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{record.bankName || record.file?.originalName || 'Bank statement'}</span><span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"><Icon aria-hidden="true" className="size-3" />{labels[record.status] ?? record.status} · {record.importedCount ?? 0}/{record.parsedTransactionCount ?? 0} imported</span>{record.createdAt && <span className="mt-1 block text-[11px] text-muted-foreground">{formatTxnDate(record.createdAt, { timeZone })}</span>}</span></button>
          })}
        </div>
      )}
    </section>
  )
}

export default StatementImportHistory
