import GlassCard from '@/components/common/GlassCard.jsx'
import { useLowPower } from '@/hooks/useLowPower.js'

function FinancialHealthIndicators({ dimensions = [], positiveHabits = [], areas = [] }) {
  const { lowPower } = useLowPower()
  const availableDimensions = (Array.isArray(dimensions) ? dimensions : [])
    .filter((item) => item && typeof item.name === 'string')
  const strengths = new Set((Array.isArray(positiveHabits) ? positiveHabits : []).map((item) => item?.name).filter(Boolean))
  const concerns = new Set((Array.isArray(areas) ? areas : []).map((item) => item?.name).filter(Boolean))

  return (
    <section aria-labelledby="health-indicators-title">
      <div className="mb-3">
        <h2 className="text-lg font-semibold" id="health-indicators-title">Financial health indicators</h2>
        <p className="mt-1 text-sm text-muted-foreground">Only factors supplied by the financial health service are shown.</p>
      </div>
      {availableDimensions.length ? (
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {availableDimensions.map((dimension, index) => {
            const scoreAvailable = typeof dimension.score === 'number' && Number.isFinite(dimension.score)
            const status = strengths.has(dimension.name)
              ? 'Strength'
              : concerns.has(dimension.name)
                ? 'Needs attention'
                : 'Status not provided'
            return (
              <GlassCard
                className="min-w-0 p-4 sm:p-5"
                key={`${dimension.name}-${index}`}
                variant={lowPower ? 'flat' : 'default'}
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="min-w-0 text-sm font-semibold">{dimension.name}</h3>
                  <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-medium ${
                    status === 'Strength'
                      ? 'bg-accent-teal/10 text-accent-teal'
                      : status === 'Needs attention'
                        ? 'bg-warning/10 text-warning'
                        : 'bg-muted text-muted-foreground'
                  }`}>
                    {status}
                  </span>
                </div>
                <p className="mt-3 text-2xl font-semibold tabular">
                  {scoreAvailable ? <>{dimension.score}<span className="ml-1 text-xs font-normal text-muted-foreground">/ 100</span></> : 'Not provided'}
                </p>
                {scoreAvailable && (
                  <div
                    aria-label={`${dimension.name} score`}
                    aria-valuemax="100"
                    aria-valuemin="0"
                    aria-valuenow={Math.min(100, Math.max(0, dimension.score))}
                    className="mt-3 h-2 overflow-hidden rounded-full bg-muted"
                    role="progressbar"
                  >
                    <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent-blue" style={{ width: `${Math.min(100, Math.max(0, dimension.score))}%` }} />
                  </div>
                )}
                {typeof dimension.weight === 'number' && Number.isFinite(dimension.weight) && (
                  <p className="mt-2 text-[11px] text-muted-foreground">Score weight: {dimension.weight}%</p>
                )}
                {dimension.explanation && (
                  <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{dimension.explanation}</p>
                )}
              </GlassCard>
            )
          })}
        </div>
      ) : (
        <div className="glass-flat rounded-2xl p-5 text-sm text-muted-foreground">
          Detailed financial indicators were not returned for this score.
        </div>
      )}
    </section>
  )
}

export default FinancialHealthIndicators
