import { Activity, ArrowLeftRight, ListFilter, WalletCards } from 'lucide-react'
import GlassCard from '@/components/common/GlassCard.jsx'

const items = [
  {
    icon: Activity,
    title: 'Track income and expenses',
    desc: 'Record activity with a category, wallet, date, and optional notes.',
    accent: 'violet',
  },
  {
    icon: WalletCards,
    title: 'Keep wallets together',
    desc: 'See balances across cash, bank, UPI, and card wallets in one place.',
    accent: 'blue',
  },
  {
    icon: ListFilter,
    title: 'Find what you need',
    desc: 'Review transaction history and filter activity by its details.',
    accent: 'cyan',
  },
  {
    icon: ArrowLeftRight,
    title: 'Move money between wallets',
    desc: 'Record wallet transfers separately from your everyday spending.',
    accent: 'pink',
  },
]

export default function BentoGrid() {
  return (
    <div className="landing-feature-grid">
      {items.map(({ icon: Icon, title, desc, accent }) => (
        <GlassCard className={`landing-feature-card landing-accent-${accent}`} hoverLift key={title}>
          <span className="landing-feature-icon"><Icon aria-hidden="true" /></span>
          <h3>{title}</h3>
          <p>{desc}</p>
        </GlassCard>
      ))}
    </div>
  )
}
