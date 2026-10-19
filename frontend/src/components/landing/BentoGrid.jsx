import React from 'react'
import GlassCard from '@/components/common/GlassCard.jsx'
import { ArrowRight } from 'lucide-react'

const items = [
  { title: 'Quick add', desc: 'Log a cash expense in about 3 seconds' },
  { title: 'Cash & UPI', desc: 'Works seamlessly with both cash and UPI' },
  { title: 'Your data stays yours', desc: 'Local-first privacy; nothing leaves without you' },
  { title: 'Smart insights', desc: 'Actionable insights (coming soon)' },
]

export default function BentoGrid() {
  return (
    <div id="features" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map(i => (
        <GlassCard key={i.title} className="p-4 glass-card-lift">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold">{i.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{i.desc}</p>
            </div>
            <div className="self-start text-muted-foreground"><ArrowRight /></div>
          </div>
        </GlassCard>
      ))}
    </div>
  )
}
