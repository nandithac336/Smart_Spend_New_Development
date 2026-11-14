import { m } from 'motion/react'
import CountUp from '@/components/motion/CountUp.jsx'
import GlassCard from '@/components/common/GlassCard.jsx'
import { useLowPower } from '@/hooks/useLowPower.js'
import { useMotionDisabled } from '@/hooks/useMotionDisabled.js'

const CIRCUMFERENCE = 2 * Math.PI * 48
const GRADES = {
  excellent: 'Excellent',
  good: 'Good',
  fair: 'Fair',
  needs_attention: 'Needs attention',
}

function HealthScoreCard({ score, grade, period, confidence }) {
  const { lowPower } = useLowPower()
  const motionDisabled = useMotionDisabled()
  const offset = CIRCUMFERENCE * (1 - score / 100)
  const gradeLabel = GRADES[grade] ?? 'Financial health score'
  const periodLabel = period?.startDate && period?.endDate
    ? `${period.startDate} to ${period.endDate}`
    : null

  return (
    <GlassCard
      aria-label="Overall financial health score"
      className="overflow-hidden p-5 sm:p-7"
      variant={lowPower ? 'flat' : 'strong'}
    >
      <div className="grid items-center gap-6 sm:grid-cols-[auto_1fr] sm:gap-8">
        <div
          aria-label={`Financial health score ${score} out of 100`}
          className="relative mx-auto flex size-44 items-center justify-center"
          role="img"
        >
          <svg aria-hidden="true" className="absolute inset-0 size-full -rotate-90" viewBox="0 0 112 112">
            <circle className="stroke-border/70" cx="56" cy="56" fill="none" r="48" strokeWidth="7" />
            <m.circle
              animate={{ strokeDashoffset: offset }}
              className="stroke-primary drop-shadow-[0_0_8px_rgb(145_119_255/45%)]"
              cx="56"
              cy="56"
              fill="none"
              initial={{ strokeDashoffset: CIRCUMFERENCE }}
              r="48"
              strokeDasharray={CIRCUMFERENCE}
              strokeLinecap="round"
              strokeWidth="7"
              transition={{ duration: motionDisabled ? 0 : 0.8, ease: 'easeOut' }}
            />
          </svg>
          <div className="flex flex-col items-center">
            <CountUp className="text-5xl font-bold tracking-tight text-foreground" duration={0.7} value={score} />
            <span className="mt-1 text-xs font-medium text-muted-foreground">out of 100</span>
          </div>
        </div>

        <div className="min-w-0 text-center sm:text-left">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Your financial snapshot</p>
          <h2 className="mt-2 text-xl font-semibold sm:text-2xl">Financial health score</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            The score reflects the financial indicators returned for your recorded activity. Review the factors and limitations below for context.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            {grade && (
              <span className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                {gradeLabel}
              </span>
            )}
            {confidence?.level && (
              <span className="rounded-full border border-border/70 bg-background/40 px-3 py-1 text-xs text-muted-foreground">
                {confidence.level} data confidence
              </span>
            )}
          </div>
          {periodLabel && (
            <p className="mt-4 text-xs text-muted-foreground">
              Based on {periodLabel}{period?.timeZone ? ` · ${period.timeZone}` : ''}
            </p>
          )}
        </div>
      </div>
    </GlassCard>
  )
}

export default HealthScoreCard
