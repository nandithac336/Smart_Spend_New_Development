import { m } from 'motion/react'
import { useMotionDisabled } from '@/hooks/useMotionDisabled.js'

function getPasswordStrength(password = '') {
  if (password.length >= 12 && /[A-Za-z]/.test(password) && /\d/.test(password)) {
    return { label: 'Strong', width: '100%', color: 'var(--income)' }
  }
  if (password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password)) {
    return { label: 'Okay', width: '66%', color: 'var(--accent-teal)' }
  }
  return {
    label: password ? 'Weak' : 'Add a letter and number',
    width: password ? '33%' : '0%',
    color: 'var(--expense)',
  }
}

function PasswordStrength({ password }) {
  const motionDisabled = useMotionDisabled()
  const strength = getPasswordStrength(password)

  return (
    <div className="space-y-1.5" aria-live="polite">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Password strength</span>
        <span style={{ color: strength.color }}>{strength.label}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <m.div
          animate={{ width: strength.width, backgroundColor: strength.color }}
          className="h-full rounded-full"
          initial={false}
          transition={{ duration: motionDisabled ? 0 : 0.28, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}

export default PasswordStrength
