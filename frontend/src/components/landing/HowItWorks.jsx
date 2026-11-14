import { ArrowRight, ChartNoAxesCombined, CirclePlus, Wallet } from 'lucide-react'
import Reveal from '@/components/motion/Reveal.jsx'

const steps = [
  {
    icon: CirclePlus,
    title: 'Add your activity',
    desc: 'Log income or expenses and choose the wallet and category that fit.',
  },
  {
    icon: Wallet,
    title: 'Organize your wallets',
    desc: 'Bring cash, bank, UPI, and card balances into a single workspace.',
  },
  {
    icon: ChartNoAxesCombined,
    title: 'Understand your spending',
    desc: 'Review monthly summaries, categories, and your recent transactions.',
  },
]

export default function HowItWorks() {
  return (
    <div className="landing-steps">
      {steps.map(({ icon: Icon, title, desc }, index) => (
        <Reveal className="landing-step-card glass" key={title}>
          <div className="landing-step-topline">
            <span className="landing-step-icon"><Icon aria-hidden="true" /></span>
            <span className="landing-step-number">0{index + 1}</span>
          </div>
          <h3>{title}</h3>
          <p>{desc}</p>
          {index < steps.length - 1 && <ArrowRight aria-hidden="true" className="landing-step-arrow" />}
        </Reveal>
      ))}
    </div>
  )
}
