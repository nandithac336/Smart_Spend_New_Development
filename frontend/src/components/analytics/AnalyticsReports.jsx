import { Download, FileSpreadsheet, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button.jsx'

function AnalyticsReports({ onExport, busyFormat, disabled }) {
  const busy = Boolean(busyFormat)
  return (
    <section aria-label="Reports and exports" className="glass-flat flex flex-col gap-4 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div className="max-w-2xl">
        <h2 className="text-sm font-semibold sm:text-base">Reports</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          CSV rows and PDF summary, category, and wallet totals use the selected dates and timezone. CSV contains non-trashed transaction rows, including transfers and pending-review items where present. The PDF comparison section follows the backend’s current-month comparison.
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <Button
          disabled={disabled || busy}
          onClick={() => onExport('csv')}
          variant="outline"
        >
          <FileSpreadsheet aria-hidden="true" />
          {busyFormat === 'csv' ? 'Preparing CSV…' : 'Export CSV'}
        </Button>
        <Button
          disabled={disabled || busy}
          onClick={() => onExport('pdf')}
          variant="outline"
        >
          {busyFormat === 'pdf' ? <Download aria-hidden="true" /> : <FileText aria-hidden="true" />}
          {busyFormat === 'pdf' ? 'Preparing PDF…' : 'Download PDF'}
        </Button>
      </div>
      <span aria-live="polite" className="sr-only">{busy ? `Preparing ${busyFormat.toUpperCase()} report` : ''}</span>
    </section>
  )
}

export default AnalyticsReports
