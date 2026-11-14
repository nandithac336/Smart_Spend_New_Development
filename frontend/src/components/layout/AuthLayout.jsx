import { useEffect } from 'react'
import { m, useAnimate } from 'motion/react'
import { ArrowUpRight, ChartNoAxesCombined, WalletCards } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMotionDisabled } from '@/hooks/useMotionDisabled.js'

const capabilities = [
  { icon: ChartNoAxesCombined, title: 'Understand your spending', detail: 'See expenses and categories together.' },
  { icon: WalletCards, title: 'Keep wallets in view', detail: 'Review balances and recent activity.' },
]

function Brand({ compact = false }) {
  return (
    <Link aria-label="SmartSpend home" className="auth-brand inline-flex w-fit items-center gap-3" to="/">
      <span className="auth-brand-mark flex size-11 items-center justify-center rounded-2xl">
        <WalletCards aria-hidden="true" className="size-5" />
      </span>
      <span>
        <span className="block text-base font-bold tracking-tight">SmartSpend</span>
        {!compact && <span className="block text-[11px] tracking-wide text-muted-foreground">PERSONAL FINANCE, IN FOCUS</span>}
      </span>
    </Link>
  )
}

function AuthLayout({ children, className = '', failedAttempt = 0 }) {
  const motionDisabled = useMotionDisabled()
  const [scope, animate] = useAnimate()

  useEffect(() => {
    if (failedAttempt === 0 || motionDisabled) return

    animate(
      scope.current,
      { x: [0, -7, 7, -5, 5, 0] },
      { duration: 0.36, ease: 'easeInOut' },
    )
  }, [animate, failedAttempt, motionDisabled, scope])

  return (
    <main className="auth-page relative isolate min-h-screen overflow-hidden px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-6">
      <div className="auth-orb auth-orb-purple" aria-hidden="true" />
      <div className="auth-orb auth-orb-blue" aria-hidden="true" />
      <div className="auth-layout relative mx-auto grid min-h-[calc(100vh-3rem)] w-full max-w-[1440px] gap-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(400px,0.92fr)] lg:gap-8">
        <section className="auth-story relative hidden overflow-hidden rounded-[2rem] border p-8 lg:flex lg:min-h-[calc(100vh-3rem)] lg:flex-col lg:justify-between lg:p-10 xl:p-14">
          <div className="auth-story-orbit auth-story-orbit-one" aria-hidden="true" />
          <div className="auth-story-orbit auth-story-orbit-two" aria-hidden="true" />
          <Brand />

          <div className="relative z-10 max-w-2xl">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold tracking-wide text-primary">
              <span className="size-1.5 rounded-full bg-primary" />
              A clearer view of your money
            </p>
            <h1 className="max-w-xl text-4xl font-semibold leading-[1.14] tracking-[-0.04em] xl:text-6xl">
              Make every rupee
              <span className="auth-gradient-text block">a little clearer.</span>
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-muted-foreground">
              Bring everyday transactions, wallets, and spending insights into one calm, focused space.
            </p>

            <div className="mt-9 grid max-w-xl gap-3 sm:grid-cols-2">
              {capabilities.map(({ icon: Icon, title, detail }) => (
                <div className="auth-capability flex min-w-0 items-start gap-3 rounded-2xl p-4" key={title}>
                  <span className="auth-capability-icon flex size-10 shrink-0 items-center justify-center rounded-xl">
                    <Icon aria-hidden="true" className="size-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{title}</span>
                    <span className="mt-1 block text-xs leading-5 text-muted-foreground">{detail}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <p className="relative z-10 text-xs text-muted-foreground">Your finances, organized around your everyday life.</p>
        </section>

        <section className="flex min-h-[calc(100vh-3rem)] items-center justify-center py-4 sm:py-6 lg:py-0">
          <m.div
            ref={scope}
            className={`auth-card glass-strong w-full max-w-md rounded-[1.75rem] p-6 shadow-2xl sm:p-8 ${className}`}
          >
            <div className="mb-7 lg:hidden">
              <Brand compact />
              <p className="mt-4 text-sm text-muted-foreground">A clearer view of your money starts here.</p>
            </div>
            {children}
            <div className="auth-card-footer mt-7 flex items-center justify-center gap-1.5 border-t pt-5 text-xs text-muted-foreground">
              <span>SmartSpend</span>
              <span aria-hidden="true">·</span>
              <span>Personal finance, in focus</span>
              <ArrowUpRight aria-hidden="true" className="size-3.5 text-primary" />
            </div>
          </m.div>
        </section>
      </div>
    </main>
  )
}

export default AuthLayout
