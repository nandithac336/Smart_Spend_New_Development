import { useMotionDisabled } from '@/hooks/useMotionDisabled.js'

function SubscriptionLoading() {
  const motionDisabled = useMotionDisabled()
  const animation = motionDisabled ? '' : 'animate-pulse'
  return (
    <div aria-busy="true" aria-label="Loading subscriptions" className="grid gap-4 md:grid-cols-2">
      {Array.from({ length: 4 }, (_, index) => <div className={`glass-flat h-64 rounded-2xl ${animation}`} key={index} />)}
    </div>
  )
}

export default SubscriptionLoading
