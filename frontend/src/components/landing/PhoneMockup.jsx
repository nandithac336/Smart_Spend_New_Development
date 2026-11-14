import { Activity, ArrowDownToLine, ArrowUpFromLine, PieChart, WalletCards } from 'lucide-react'

const modules = [
  { icon: WalletCards, title: 'Wallet balances', detail: 'Cash, bank, UPI and card' },
  { icon: PieChart, title: 'Category spending', detail: 'Your monthly breakdown' },
  { icon: Activity, title: 'Recent activity', detail: 'Income and expenses together' },
]

export default function ProductPreview() {
  return (
    <figure aria-label="SmartSpend dashboard preview" className="landing-product-preview">
      <div className="landing-preview-topbar">
        <div className="landing-preview-brand">
          <span className="landing-preview-mark"><WalletCards aria-hidden="true" /></span>
          <span>SmartSpend</span>
        </div>
        <span className="landing-preview-status">Personal dashboard</span>
      </div>

      <div className="landing-preview-heading">
        <div>
          <p>YOUR OVERVIEW</p>
          <h2>A clearer view of your money</h2>
        </div>
        <span aria-hidden="true" className="landing-preview-avatar">S</span>
      </div>

      <div className="landing-preview-summary">
        <div className="landing-preview-balance">
          <span>Total balance</span>
          <strong>Your wallets, at a glance</strong>
          <small>Personal data shown after sign in</small>
        </div>
        <div className="landing-preview-flow">
          <div><ArrowDownToLine aria-hidden="true" /><span>Income</span></div>
          <div><ArrowUpFromLine aria-hidden="true" /><span>Expenses</span></div>
          <p>Follow your monthly activity</p>
        </div>
      </div>

      <div className="landing-preview-list">
        <div className="landing-preview-list-heading">
          <strong>Your finances, organized</strong>
          <span>Dashboard</span>
        </div>
        {modules.map(({ icon: Icon, title, detail }) => (
          <div className="landing-preview-module" key={title}>
            <span className="landing-preview-module-icon"><Icon aria-hidden="true" /></span>
            <span><strong>{title}</strong><small>{detail}</small></span>
            <span aria-hidden="true" className="landing-preview-module-dot" />
          </div>
        ))}
      </div>
      <figcaption className="landing-preview-caption">A preview of the tools you can use with your own data.</figcaption>
    </figure>
  )
}
