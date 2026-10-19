import { m } from 'motion/react'
import { staggerItem } from '@/lib/motion.js'
import { useMotionDisabled } from '@/hooks/useMotionDisabled.js'

function StaggerItem({ children, className, ...props }) {
  const motionDisabled = useMotionDisabled()

  if (motionDisabled) return <div className={className}>{children}</div>

  return (
    <m.div className={className} variants={staggerItem} {...props}>
      {children}
    </m.div>
  )
}

export default StaggerItem
