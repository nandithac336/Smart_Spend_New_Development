import { m } from 'motion/react'
import { snappy } from '@/lib/motion.js'
import { useMotionDisabled } from '@/hooks/useMotionDisabled.js'

function Pressable({ children, className, ...props }) {
  const motionDisabled = useMotionDisabled()

  if (motionDisabled) return <div className={className} {...props}>{children}</div>

  return (
    <m.div
      className={className}
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', ...snappy }}
      {...props}
    >
      {children}
    </m.div>
  )
}

export default Pressable
