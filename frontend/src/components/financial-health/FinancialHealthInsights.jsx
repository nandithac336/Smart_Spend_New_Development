import { ArrowUpRight, Check, Lightbulb, TriangleAlert } from 'lucide-react'
import { Link } from 'react-router-dom'
import GlassCard from '@/components/common/GlassCard.jsx'
import { useLowPower } from '@/hooks/useLowPower.js'

const DESTINATIONS = [
  { match: /budget/i, to: '/budgets', label: 'Review budgets' },
  { match: /goal|savings/i, to: '/goals', label: 'View savings goals' },
  { match: /subscription/i, to: '/subscriptions', label: 'Review subscriptions' },
  { match: /recurring/i, to: '/recurring', label: 'View recurring expenses' },
  { match: /spending|income|expense/i, to: '/analytics', label: 'Open analytics' },
]

function destinationFor(name) {
  return DESTINATIONS.find((destination) => destination.match.test(name)) ?? null
}

function FinancialHealthInsights({ positiveHabits = [], areas = [], dimensions = [] }) {
  const { lowPower } = useLowPower()
  const availableHabits = (Array.isArray(positiveHabits) ? positiveHabits : []).filter(Boolean)
  const availableAreas = (Array.isArray(areas) ? areas : []).filter(Boolean)
  const recommendations = (Array.isArray(dimensions) ? dimensions : []).flatMap((dimension) =>
    Array.isArray(dimension?.improvementSuggestions)
      ? dimension.improvementSuggestions
        .filter((text) => typeof text === 'string' && text.trim())
        .map((text) => ({ name: dimension.name, text }))
      : [],
  )

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <section aria-labelledby="health-strengths-title">
        <div className="mb-3 flex items-center gap-2">
          <Check aria-hidden="true" className="size-4 text-accent-teal" />
          <h2 className="text-lg font-semibold" id="health-strengths-title">Financial strengths</h2>
        </div>
        {availableHabits.length ? (
          <div className="space-y-3">
            {availableHabits.map((habit, index) => (
              <GlassCard className="p-4" key={`${habit.name}-${index}`} variant={lowPower ? 'flat' : 'default'}>
                <h3 className="text-sm font-semibold">{habit.name}</h3>
                {typeof habit.score === 'number' && <p className="mt-1 text-xs text-accent-teal">Indicator score: {habit.score}/100</p>}
                {habit.explanation && <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{habit.explanation}</p>}
              </GlassCard>
            ))}
          </div>
        ) : (
          <div className="glass-flat rounded-2xl p-4 text-sm text-muted-foreground">No strengths were returned for the available indicators.</div>
        )}
      </section>

      <section aria-labelledby="health-improvements-title">
        <div className="mb-3 flex items-center gap-2">
          <TriangleAlert aria-hidden="true" className="size-4 text-warning" />
          <h2 className="text-lg font-semibold" id="health-improvements-title">Areas for improvement</h2>
        </div>
        {availableAreas.length ? (
          <div className="space-y-3">
            {availableAreas.map((area, index) => {
              const destination = destinationFor(area.name ?? '')
              return (
                <GlassCard className="p-4" key={`${area.name}-${index}`} variant={lowPower ? 'flat' : 'default'}>
                  <h3 className="text-sm font-semibold">{area.name}</h3>
                  {area.explanation && <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{area.explanation}</p>}
                  {Array.isArray(area.suggestions) && area.suggestions.map((suggestion) => (
                    <p className="mt-2 text-xs text-foreground/90" key={suggestion}>
                      <Lightbulb aria-hidden="true" className="mr-1 inline size-3.5 text-primary" />
                      {suggestion}
                    </p>
                  ))}
                  {destination && (
                    <Link className="mt-3 inline-flex min-h-9 items-center gap-1 text-xs font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" to={destination.to}>
                      {destination.label}<ArrowUpRight aria-hidden="true" className="size-3.5" />
                    </Link>
                  )}
                </GlassCard>
              )
            })}
          </div>
        ) : (
          <div className="glass-flat rounded-2xl p-4 text-sm text-muted-foreground">No areas for improvement were returned for the available indicators.</div>
        )}
      </section>

      <section aria-labelledby="health-recommendations-title" className="xl:col-span-2">
        <div className="mb-3 flex items-center gap-2">
          <Lightbulb aria-hidden="true" className="size-4 text-primary" />
          <h2 className="text-lg font-semibold" id="health-recommendations-title">Personalized recommendations</h2>
        </div>
        {recommendations.length ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {recommendations.map((recommendation, index) => {
              const destination = destinationFor(recommendation.name ?? '')
              return (
                <li className={`rounded-2xl p-4 ${lowPower ? 'glass-flat' : 'glass'}`} key={`${recommendation.name}-${recommendation.text}-${index}`}>
                  <p className="text-xs font-semibold text-muted-foreground">{recommendation.name}</p>
                  <p className="mt-2 text-sm leading-relaxed">{recommendation.text}</p>
                  {destination && (
                    <Link className="mt-3 inline-flex min-h-9 items-center gap-1 text-xs font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" to={destination.to}>
                      {destination.label}<ArrowUpRight aria-hidden="true" className="size-3.5" />
                    </Link>
                  )}
                </li>
              )
            })}
          </ul>
        ) : (
          <div className="glass-flat rounded-2xl p-4 text-sm text-muted-foreground">No recommendations were returned for the available indicators.</div>
        )}
      </section>
    </div>
  )
}

export default FinancialHealthInsights
