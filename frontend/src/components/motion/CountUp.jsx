import { useEffect } from 'react'
import { animate, m, useMotionValue, useTransform } from 'motion/react'
import { useMotionDisabled } from '@/hooks/useMotionDisabled.js'
import { formatINR } from '@/lib/money.js'

function CountUp({ value, currency = false, duration = 0.7, className, ...props }) {
  const numericValue = Number(value)
  const count = useMotionValue(0)
  const motionDisabled = useMotionDisabled()
  const display = useTransform(count, (current) =>
    currency ? formatINR(Math.round(current)) : Math.round(current).toLocaleString('en-IN'),
  )
  const finalLabel = currency
    ? formatINR(numericValue)
    : numericValue.toLocaleString('en-IN')

  useEffect(() => {
    if (!Number.isFinite(numericValue)) return
    if (motionDisabled) {
      count.set(numericValue)
      return
    }

    const controls = animate(count, numericValue, {
      duration: Math.min(Math.max(duration, 0), 0.7),
      ease: 'easeOut',
    })

    return () => controls.stop()
  }, [count, duration, motionDisabled, numericValue])

  return (
    <m.span
      aria-label={finalLabel}
      className={`tabular ${className ?? ''}`}
      {...props}
    >
      {display}
    </m.span>
  )
}

export default CountUp
