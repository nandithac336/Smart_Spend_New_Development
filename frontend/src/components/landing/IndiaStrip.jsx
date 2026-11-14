import { IndianRupee, LockKeyhole, SlidersHorizontal } from 'lucide-react'

const benefits = [
  {
    icon: IndianRupee,
    title: 'Rupee-first',
    description: 'Amounts are formatted in INR for everyday spending in India.',
  },
  {
    icon: LockKeyhole,
    title: 'Your own account',
    description: 'Transactions and wallets are associated with your signed-in account.',
  },
  {
    icon: SlidersHorizontal,
    title: 'Useful detail, when you need it',
    description: 'Move from monthly summaries to categories and individual activity.',
  },
]

export default function IndiaStrip() {
  return (
    <div className="landing-benefits-grid">
      {benefits.map(({ icon: Icon, title, description }) => (
        <article className="landing-benefit" key={title}>
          <span className="landing-benefit-icon"><Icon aria-hidden="true" /></span>
          <div>
            <h3>{title}</h3>
            <p>{description}</p>
          </div>
        </article>
      ))}
    </div>
  )
}
