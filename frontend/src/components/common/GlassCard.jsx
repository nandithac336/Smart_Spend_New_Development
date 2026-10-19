import { cn } from '@/lib/utils.js'

const variants = {
  default: 'glass',
  strong: 'glass-strong',
  flat: 'glass-flat',
}

function GlassCard({
  variant = 'default',
  hoverLift = false,
  className,
  children,
  ...props
}) {
  return (
    <section
      className={cn(
        variants[variant] ?? variants.default,
        hoverLift && 'glass-card-lift',
        'p-5',
        className,
      )}
      {...props}
    >
      {children}
    </section>
  )
}

export default GlassCard
