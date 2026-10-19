import { cn } from '@/lib/utils.js'

function AnimatedSwitch({ checked, onCheckedChange, label, className, ...props }) {
  return (
    <button
      aria-checked={checked}
      aria-label={label}
      className={cn(
        'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border border-border bg-muted transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        checked && 'border-primary bg-primary',
        className,
      )}
      onClick={() => onCheckedChange(!checked)}
      role="switch"
      type="button"
      {...props}
    >
      <span
        className={cn(
          'size-5 rounded-full bg-card shadow-sm transition-transform duration-200',
          checked && 'translate-x-5 bg-primary-foreground',
          !checked && 'translate-x-0.5',
        )}
      />
    </button>
  )
}

export default AnimatedSwitch
