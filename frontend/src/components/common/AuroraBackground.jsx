import { cn } from '@/lib/utils.js'
import { useMotionDisabled } from '@/hooks/useMotionDisabled.js'

function AuroraBackground({ animated = false, className, children }) {
  const motionDisabled = useMotionDisabled()

  return (
    <div
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute inset-0 -z-10 overflow-hidden',
        animated && !motionDisabled && 'aurora-animated',
        className,
      )}
    >
      <span className="aurora-blob aurora-blob-one -left-20 -top-24 h-64 w-64" />
      <span className="aurora-blob aurora-blob-two -right-20 top-1/4 h-72 w-72" />
      <span className="aurora-blob aurora-blob-three bottom-0 left-1/3 h-56 w-56" />
      {children}
    </div>
  )
}

export default AuroraBackground
