import { cn } from '@/lib/utils.js'

function Loader({ className, label = 'Loading' }) {
  return (
    <span
      aria-label={label}
      className={cn('inline-flex items-center gap-1.5', className)}
      role="status"
    >
      <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.2s]" />
      <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.1s]" />
      <span className="size-1.5 animate-bounce rounded-full bg-current" />
    </span>
  )
}

export default Loader
