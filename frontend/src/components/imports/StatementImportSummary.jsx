import { TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button.jsx'

function StatementImportSummary({ record, skippedCount, skippedCountLoading, skippedCountError, retrySkipped }) {
  return (
    <header className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-xs font-semibold uppercase tracking-wide text-primary">{record.file?.format?.toUpperCase()} statement · {record.status.replaceAll('_', ' ')}</p><h2 className="mt-1 text-base font-semibold">{record.bankName || record.file?.originalName || 'Imported statement'}</h2></div>
        <div className="flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-primary/10 px-2.5 py-1 text-primary">{record.parsedTransactionCount ?? 0} parsed</span><span className="rounded-full bg-income/10 px-2.5 py-1 text-income">{record.importedCount ?? 0} imported</span><span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">{skippedCountError ? 'Skipped count unavailable' : skippedCountLoading ? 'Loading skipped…' : `${skippedCount ?? 0} skipped`}</span>{record.duplicateCount > 0 && <span className="rounded-full bg-amber-400/10 px-2.5 py-1 text-amber-200">{record.duplicateCount} possible duplicates</span>}</div>
      </div>
      {record.errorDetails?.message && <p className="flex items-start gap-2 rounded-xl border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive" role="alert"><TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />{record.errorDetails.message}</p>}
      {skippedCountError && <Button onClick={retrySkipped} size="sm" type="button" variant="outline">Retry skipped count</Button>}
    </header>
  )
}

export default StatementImportSummary
