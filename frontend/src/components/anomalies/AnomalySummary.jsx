const items = [
  ['new', 'New flags', 'text-primary'],
  ['highAndCritical', 'High / critical', 'text-rose-300'],
  ['reviewed', 'Reviewed', 'text-sky-300'],
  ['dismissed', 'Dismissed', 'text-muted-foreground'],
]

function AnomalySummary({ summary, loading }) {
  return (
    <section aria-label="Anomaly overview" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map(([key, label, color]) => (
        <article className="glass-flat rounded-2xl p-4" key={key}>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className={`mt-2 text-2xl font-bold tabular-nums ${color}`} aria-busy={loading}>
            {loading ? '—' : summary?.[key] ?? 0}
          </p>
        </article>
      ))}
    </section>
  )
}

export default AnomalySummary
