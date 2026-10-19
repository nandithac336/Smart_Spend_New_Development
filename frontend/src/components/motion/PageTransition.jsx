import { AnimatePresence, m } from 'motion/react'
import { useLocation, Outlet } from 'react-router-dom'
import { useMotionDisabled } from '@/hooks/useMotionDisabled.js'

function PageTransition({ children }) {
  const location = useLocation()
  const motionDisabled = useMotionDisabled()
  const content = children ?? <Outlet />

  if (motionDisabled) return <div>{content}</div>

  return (
    <AnimatePresence mode="wait" initial={false}>
      <m.div
        key={location.pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        {content}
      </m.div>
    </AnimatePresence>
  )
}

export default PageTransition
