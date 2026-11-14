import { useState } from 'react'
import { ArrowUpRight, Menu, WalletCards, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button.jsx'

function AuthLinks({ authenticated, mobile = false, onNavigate }) {
  if (authenticated) {
    return (
      <Button asChild size={mobile ? 'default' : 'sm'}>
        <Link onClick={onNavigate} to="/dashboard">
          Open dashboard <ArrowUpRight aria-hidden="true" />
        </Link>
      </Button>
    )
  }

  return (
    <>
      <Button asChild className={mobile ? 'w-full' : undefined} size={mobile ? 'default' : 'sm'}>
        <Link onClick={onNavigate} to="/register">Get started</Link>
      </Button>
      {mobile ? (
        <Link className="landing-mobile-login" onClick={onNavigate} to="/login">Log in</Link>
      ) : (
        <Button asChild variant="ghost">
          <Link to="/login">Log in</Link>
        </Button>
      )}
    </>
  )
}

export default function Navbar({ authenticated = false }) {
  const [open, setOpen] = useState(false)
  const closeMenu = () => setOpen(false)

  return (
    <header className="landing-nav-wrap">
      <div className="landing-nav glass-strong">
        <Link aria-label="SmartSpend home" className="landing-brand" onClick={closeMenu} to="/">
          <span className="landing-brand-mark"><WalletCards aria-hidden="true" /></span>
          <span>Smart<span>Spend</span></span>
        </Link>

        <nav aria-label="Main navigation" className="landing-desktop-nav">
          <a href="#features">Features</a>
          <a href="#how">How it works</a>
          <a href="#benefits">Why SmartSpend</a>
          <AuthLinks authenticated={authenticated} />
        </nav>

        <button
          aria-expanded={open}
          aria-label={open ? 'Close menu' : 'Open menu'}
          className="landing-menu-button"
          onClick={() => setOpen((value) => !value)}
          type="button"
        >
          {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
      </div>

      {open && (
        <nav aria-label="Mobile navigation" className="landing-mobile-nav glass-strong">
          <a href="#features" onClick={closeMenu}>Features</a>
          <a href="#how" onClick={closeMenu}>How it works</a>
          <a href="#benefits" onClick={closeMenu}>Why SmartSpend</a>
          <div className="landing-mobile-auth">
            <AuthLinks authenticated={authenticated} mobile onNavigate={closeMenu} />
          </div>
        </nav>
      )}
    </header>
  )
}
