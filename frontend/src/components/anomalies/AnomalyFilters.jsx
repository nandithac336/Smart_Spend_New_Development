import { Input } from '@/components/ui/input.jsx'

const SEVERITIES = [
  ['all', 'All severities'],
  ['low', 'Low'],
  ['medium', 'Medium'],
  ['high', 'High'],
  ['critical', 'Critical'],
]

const STATUSES = [
  ['all', 'All statuses'],
  ['new', 'New'],
  ['reviewed', 'Reviewed'],
  ['dismissed', 'Dismissed'],
  ['resolved', 'Resolved'],
]

function AnomalyFilters({ filters, onChange, onClear, disabled }) {
  return (
    <section aria-label="Filter unusual activity" className="glass-flat grid gap-3 rounded-2xl p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto]">
      <label className="space-y-1.5 text-xs font-medium">
        Severity
        <select
          className="h-10 w-full rounded-xl border border-input bg-background/45 px-3 text-sm"
          disabled={disabled}
          onChange={(event) => onChange('severity', event.target.value)}
          value={filters.severity || 'all'}
        >
          {SEVERITIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label className="space-y-1.5 text-xs font-medium">
        Status
        <select
          className="h-10 w-full rounded-xl border border-input bg-background/45 px-3 text-sm"
          disabled={disabled}
          onChange={(event) => onChange('status', event.target.value)}
          value={filters.status || 'all'}
        >
          {STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label className="space-y-1.5 text-xs font-medium">
        Detected from
        <Input aria-label="Detected from" className="h-10" disabled={disabled} max={filters.endDate || undefined} onChange={(event) => onChange('startDate', event.target.value)} type="date" value={filters.startDate || ''} />
      </label>
      <label className="space-y-1.5 text-xs font-medium">
        Detected to
        <Input aria-label="Detected to" className="h-10" disabled={disabled} min={filters.startDate || undefined} onChange={(event) => onChange('endDate', event.target.value)} type="date" value={filters.endDate || ''} />
      </label>
      <button className="self-end rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50" disabled={disabled || !Object.values(filters).some(Boolean)} onClick={onClear} type="button">
        Clear filters
      </button>
    </section>
  )
}

export default AnomalyFilters
