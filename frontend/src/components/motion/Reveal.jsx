import { m } from 'motion/react'
import { fadeUp } from '@/lib/motion.js'
import { useMotionDisabled } from '@/hooks/useMotionDisabled.js'

function Reveal({ children, className, ...props }) {
  const motionDisabled = useMotionDisabled()

  if (motionDisabled) return <div className={className}>{children}</div>

  return (
    <m.div
      className={className}
      variants={fadeUp}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.15 }}
      {...props}
    >
      {children}
    </m.div>
  )
}

export default Reveal
