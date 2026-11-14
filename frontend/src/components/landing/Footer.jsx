import React from 'react'
import { Link } from 'react-router-dom'
import { WalletCards } from 'lucide-react'

const CURRENT_YEAR = new Date().getFullYear()

export default function Footer() {
  return (
    <footer className="landing-footer">
      <div className="landing-footer-inner">
        <Link aria-label="SmartSpend home" className="landing-brand" to="/">
          <span className="landing-brand-mark"><WalletCards aria-hidden="true" /></span>
          <span>Smart<span>Spend</span></span>
        </Link>
        <nav aria-label="Footer navigation" className="landing-footer-links">
          <a href="#features">Features</a>
          <a href="#how">How it works</a>
          <Link to="/login">Log in</Link>
          <Link to="/register">Get started</Link>
        </nav>
        <p>© {CURRENT_YEAR} SmartSpend</p>
      </div>
    </footer>
  )
}
