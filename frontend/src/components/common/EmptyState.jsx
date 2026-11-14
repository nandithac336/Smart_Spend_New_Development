import { Inbox } from 'lucide-react'

function EmptyState({ title, description, icon: Icon = Inbox, action, illustration, className = '' }) {
  return (
    <section className={`glass-strong flex min-h-56 flex-col items-center justify-center rounded-2xl px-6 py-10 text-center ${className}`}>
      {illustration || (
        <span className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon aria-hidden="true" className="size-6" />
        </span>
      )}
      <h2 className="text-base font-semibold">{title}</h2>
      {description && <p className="mt-2 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </section>
  )
}

export default EmptyState
