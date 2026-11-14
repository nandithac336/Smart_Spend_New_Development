import { TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button.jsx'

function ErrorState({
  title = 'Something went wrong',
  description = 'We couldn’t load this information.',
  onRetry,
  secondaryAction,
}) {
  return (
    <section className="glass-strong flex min-h-56 flex-col items-center justify-center rounded-2xl px-6 py-10 text-center">
      <span className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
        <TriangleAlert aria-hidden="true" className="size-6" />
      </span>
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">{description}</p>
      {(onRetry || secondaryAction) && (
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {onRetry && <Button onClick={onRetry} variant="outline">Retry</Button>}
          {secondaryAction}
        </div>
      )}
    </section>
  )
}

export default ErrorState
