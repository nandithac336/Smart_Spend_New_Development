import { ArrowRight, LockKeyhole, Smartphone, Timer } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth.js'
import AuroraBackground from '@/components/common/AuroraBackground.jsx'
import GlassCard from '@/components/common/GlassCard.jsx'
import { Button } from '@/components/ui/button.jsx'

const features = [
  { icon: Smartphone, title: 'Cash and UPI', description: 'Keep all your everyday spending in one clear view.' },
  { icon: Timer, title: 'Quick to add', description: 'Log a cash expense in about 3 seconds.' },
  { icon: LockKeyhole, title: 'Private to you', description: 'Your financial life stays yours.' },
]

function Landing() {
  const { status } = useAuth()
  const authenticated = status === 'authenticated'

  return (
    <main className="relative isolate min-h-screen overflow-hidden px-5 py-8 sm:px-8">
      <AuroraBackground animated />
      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl flex-col">
        <header className="flex items-center justify-between">
          <Link className="text-lg font-bold tracking-tight" to="/">Smart Spend</Link>
          <Button asChild variant="outline">
            <Link to={authenticated ? '/dashboard' : '/login'}>
              {authenticated ? 'Open dashboard' : 'Log in'}
            </Link>
          </Button>
        </header>

        <section className="flex flex-1 flex-col justify-center py-16 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
            Your money, in focus
          </p>
          <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">
            Track every rupee. Spend smarter.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
            A calmer, clearer way to stay on top of everyday spending.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link to={authenticated ? '/dashboard' : '/register'}>
                {authenticated ? 'Open dashboard' : 'Get started'}
                <ArrowRight />
              </Link>
            </Button>
            {!authenticated && (
              <Button asChild size="lg" variant="outline">
                <Link to="/login">Log in</Link>
              </Button>
            )}
          </div>
        </section>

        <section aria-label="Features" className="grid gap-4 pb-4 sm:grid-cols-3">
          {features.map(({ icon: Icon, title, description }) => (
            <GlassCard className="text-left" key={title}>
              <span className="inline-flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                <Icon aria-hidden="true" className="size-5" />
              </span>
              <h2 className="mt-4 font-semibold">{title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            </GlassCard>
          ))}
        </section>
      </div>
    </main>
  )
}

export default Landing
