import { useEffect } from 'react'
import { AnimatePresence, m } from 'motion/react'
import { useLocation, useOutlet } from 'react-router-dom'
import { useMotionDisabled } from '@/hooks/useMotionDisabled.js'

function PageTransition() {
  const location = useLocation()
  const outlet = useOutlet()
  const motionDisabled = useMotionDisabled()

  useEffect(() => {
    if (motionDisabled) window.scrollTo(0, 0)
  }, [location.pathname, motionDisabled])

  if (motionDisabled) return outlet

  return (
    <AnimatePresence
      initial={false}
      mode="wait"
      onExitComplete={() => window.scrollTo(0, 0)}
    >
      <m.div
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        initial={{ opacity: 0, y: 8 }}
        key={location.pathname}
        transition={{ duration: 0.16, ease: 'easeOut' }}
      >
        {outlet}
      </m.div>
    </AnimatePresence>
  )
}

export default PageTransition
