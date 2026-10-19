import { Children } from 'react'
import { m } from 'motion/react'
import { staggerContainer } from '@/lib/motion.js'
import { useMotionDisabled } from '@/hooks/useMotionDisabled.js'

function StaggerGroup({ children, className, ...props }) {
  const cappedChildren = Children.toArray(children).slice(0, 8)
  const motionDisabled = useMotionDisabled()

  if (motionDisabled) return <div className={className}>{cappedChildren}</div>

  return (
    <m.div
      className={className}
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      {...props}
    >
      {cappedChildren}
    </m.div>
  )
}

export default StaggerGroup
