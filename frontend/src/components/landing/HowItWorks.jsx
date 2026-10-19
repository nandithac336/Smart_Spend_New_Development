import React from 'react'
import Reveal from '@/components/motion/Reveal.jsx'

const steps = [
  { title: 'Add', desc: 'Quickly add an expense with a category and amount.' },
  { title: 'See', desc: 'Organized views by day, month and category.' },
  { title: 'Save', desc: 'Find small ways to cut back and save.' },
]

export default function HowItWorks() {
  return (
    <div id="how" className="grid gap-8 sm:grid-cols-3">
      {steps.map((s) => (
        <Reveal key={s.title} className="glass p-6">
          <h4 className="text-lg font-semibold">{s.title}</h4>
          <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
        </Reveal>
      ))}
    </div>
  )
}
