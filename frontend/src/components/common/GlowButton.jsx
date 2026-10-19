import { cn } from '@/lib/utils.js'

function GlowButton({ children, className, type = 'button', ...props }) {
  return (
    <button
      className={cn(
        'glow-button rounded-xl px-4 py-2.5 font-semibold text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      type={type}
      {...props}
    >
      {children}
    </button>
  )
}

export default GlowButton
