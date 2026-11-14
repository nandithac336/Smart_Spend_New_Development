import { ShieldCheck } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth.js'

function accountCreatedAt(user) {
  if (!user?.createdAt) return 'Unavailable'
  const createdAt = new Date(user.createdAt)
  if (Number.isNaN(createdAt.getTime())) return 'Unavailable'
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'long',
    timeZone: user.timezone || 'Asia/Kolkata',
  }).format(createdAt)
}

function SecuritySettings() {
  const { user } = useAuth()

  return (
    <div className="glass-flat rounded-2xl border border-border/70 p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <ShieldCheck aria-hidden="true" className="size-5" />
        </span>
        <div>
          <h2 className="text-lg font-semibold">Security</h2>
          <p className="text-sm text-muted-foreground">Account security information available from SmartSpend.</p>
        </div>
      </div>
      <dl className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border/60 p-4">
          <dt className="text-xs text-muted-foreground">Account created</dt>
          <dd className="mt-1 text-sm font-medium">{accountCreatedAt(user)}</dd>
        </div>
        <div className="rounded-xl border border-border/60 p-4">
          <dt className="text-xs text-muted-foreground">Email verification</dt>
          <dd className="mt-1 text-sm font-medium">Not provided by the account API</dd>
        </div>
        <div className="rounded-xl border border-border/60 p-4 sm:col-span-2">
          <dt className="text-xs text-muted-foreground">Password and sessions</dt>
          <dd className="mt-1 text-sm text-muted-foreground">
            Password changes and session lists are not supported. Signing out clears local tokens and, when the server is reachable, revokes its stored refresh token. Existing access tokens remain valid until expiry; remote sign-out and login history are unavailable.
          </dd>
        </div>
      </dl>
    </div>
  )
}

export default SecuritySettings
