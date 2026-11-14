import { useMotionDisabled } from '@/hooks/useMotionDisabled.js'

function NotificationLoading() {
  const motionDisabled = useMotionDisabled()
  const pulse = motionDisabled ? '' : 'animate-pulse'

  return (
    <div aria-busy="true" aria-label="Loading notifications" className="space-y-3">
      {Array.from({ length: 4 }, (_, index) => (
        <div className={`glass-flat h-32 rounded-2xl ${pulse}`} key={index} />
      ))}
    </div>
  )
}

export default NotificationLoading
