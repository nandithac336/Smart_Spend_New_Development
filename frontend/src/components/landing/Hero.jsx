import React, { useMemo, Suspense, lazy } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button.jsx'
import AuroraBackground from '@/components/common/AuroraBackground.jsx'
import { useMotionDisabled } from '@/hooks/useMotionDisabled.js'

const PhoneMockup = lazy(() => import('./PhoneMockup'))

const rotating = ['cash', 'UPI', 'chai', 'groceries']

export default function Hero({ user }) {
  const motionDisabled = useMotionDisabled()
  const headline = useMemo(() => rotating, [])

  return (
    <section className="relative isolate overflow-hidden px-4 py-20 sm:py-28">
      <AuroraBackground animated={!motionDisabled} />

      <div className="mx-auto max-w-6xl grid gap-8 lg:grid-cols-2 lg:items-center">
        <div className="z-10 text-center lg:text-left">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Your money, in focus</p>
          <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Track every rupee. <span className="relative inline-block">Spend <span className="text-primary">smarter</span>.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
            A calmer, clearer way to stay on top of everyday spending.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
            <Button asChild size="lg" className="moving-border">
              <Link to={user ? '/dashboard' : '/register'}>
                {user ? 'Open dashboard' : 'Get started free'}
              </Link>
            </Button>
            {!user && (
              <Button asChild size="lg" variant="outline">
                <Link to="/login">Log in</Link>
              </Button>
            )}
          </div>

          <p className="mt-6 text-sm text-muted-foreground">No credit card required • Cancel anytime</p>
        </div>

        <div className="z-10 flex justify-center lg:justify-end">
          <Suspense fallback={<div className="w-64 h-96 rounded-xl glass" />}> 
            <PhoneMockup />
          </Suspense>
        </div>
      </div>
    </section>
  )
}
