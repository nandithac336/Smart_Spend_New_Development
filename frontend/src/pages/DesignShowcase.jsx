import { useState } from 'react'
import { Button } from '@/components/ui/button.jsx'
import { Skeleton } from '@/components/ui/skeleton.jsx'
import AnimatedSwitch from '@/components/common/AnimatedSwitch.jsx'
import AuroraBackground from '@/components/common/AuroraBackground.jsx'
import GlassCard from '@/components/common/GlassCard.jsx'
import GlowButton from '@/components/common/GlowButton.jsx'
import ListSkeleton from '@/components/common/ListSkeleton.jsx'
import Loader from '@/components/common/Loader.jsx'
import CountUp from '@/components/motion/CountUp.jsx'
import Pressable from '@/components/motion/Pressable.jsx'
import Reveal from '@/components/motion/Reveal.jsx'
import StaggerGroup from '@/components/motion/StaggerGroup.jsx'
import StaggerItem from '@/components/motion/StaggerItem.jsx'
import { useLowPower } from '@/hooks/useLowPower.js'

function DesignShowcase() {
  const [dark, setDark] = useState(document.documentElement.classList.contains('dark'))
  const { forceLowPower, setForceLowPower } = useLowPower()

  function toggleTheme(enabled) {
    document.documentElement.classList.toggle('dark', enabled)
    setDark(enabled)
  }

  return (
    <main className="relative isolate min-h-screen overflow-hidden px-4 py-8 sm:px-8">
      <AuroraBackground animated />
      <div className="relative mx-auto max-w-7xl space-y-8">
        <header className="glass-strong flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
              Temporary · development only
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Aurora Glass design system
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Review the visual primitives, motion, and low-power fallback.
            </p>
          </div>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <AnimatedSwitch checked={dark} label="Dark mode" onCheckedChange={toggleTheme} />
              Dark
            </label>
            <label className="flex items-center gap-2 text-sm">
              <AnimatedSwitch
                checked={forceLowPower}
                label="Force low power"
                onCheckedChange={setForceLowPower}
              />
              Low power
            </label>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <GlassCard hoverLift>
            <h2 className="font-semibold">GlassCard · default</h2>
            <p className="mt-2 text-sm text-muted-foreground">Blurred glass, with a desktop-only hover lift.</p>
          </GlassCard>
          <GlassCard variant="strong">
            <h2 className="font-semibold">GlassCard · strong</h2>
            <p className="mt-2 text-sm text-muted-foreground">More opaque glass for foreground content.</p>
          </GlassCard>
          <GlassCard variant="flat">
            <h2 className="font-semibold">GlassCard · flat</h2>
            <p className="mt-2 text-sm text-muted-foreground">Solid surface fallback.</p>
          </GlassCard>

          <GlassCard>
            <h2 className="font-semibold">Actions and loader</h2>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <GlowButton>Glow button</GlowButton>
              <Button><Loader /> <span className="ml-2">Working</span></Button>
            </div>
          </GlassCard>

          <GlassCard>
            <h2 className="font-semibold">Motion and values</h2>
            <div className="mt-4 flex flex-wrap items-center gap-5">
              <CountUp className="text-2xl font-bold" currency value={129950} />
              <Pressable><GlowButton>Press me</GlowButton></Pressable>
            </div>
          </GlassCard>

          <GlassCard>
            <h2 className="font-semibold">Reveal and stagger (max 8)</h2>
            <StaggerGroup className="mt-4 grid grid-cols-4 gap-2">
              {Array.from({ length: 10 }, (_, index) => (
                <StaggerItem className="glass-flat rounded-lg p-2 text-center text-sm" key={index}>
                  {index + 1}
                </StaggerItem>
              ))}
            </StaggerGroup>
            <Reveal className="mt-3 text-sm text-muted-foreground">
              This fades up once when it enters view.
            </Reveal>
          </GlassCard>

          <GlassCard>
            <h2 className="font-semibold">Shimmer skeletons</h2>
            <div className="mt-4 space-y-3">
              <Skeleton className="skeleton-shimmer h-4 w-2/3 animate-none" />
              <ListSkeleton count={2} />
            </div>
          </GlassCard>

          <GlassCard>
            <h2 className="font-semibold">Colors and numbers</h2>
            <div className="tabular mt-4 flex flex-wrap gap-3 text-sm">
              <span className="text-income">Income +₹2,400</span>
              <span className="text-expense">Expense −₹760</span>
              <span className="text-transfer">Transfer ₹500</span>
            </div>
          </GlassCard>
        </section>
      </div>
    </main>
  )
}

export default DesignShowcase
