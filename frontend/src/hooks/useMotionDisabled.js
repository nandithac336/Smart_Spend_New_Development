import { useReducedMotion } from 'motion/react'
import { useLowPower } from '@/hooks/useLowPower.js'

export function useMotionDisabled() {
  const prefersReducedMotion = useReducedMotion()
  const { lowPower } = useLowPower()

  return Boolean(prefersReducedMotion || lowPower)
}
