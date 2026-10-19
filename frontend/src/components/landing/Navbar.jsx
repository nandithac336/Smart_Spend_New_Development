import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button.jsx'

export default function Navbar({ user }) {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 24)
    }
    onScroll()
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header className={`fixed inset-x-0 top-4 z-50 mx-auto max-w-6xl px-4 transition-all ${scrolled ? 'backdrop-blur-md bg-white/30 dark:bg-black/30 glass' : 'bg-transparent'}`}>
      <div className="flex items-center justify-between py-3">
        <Link to="/" className="text-lg font-bold tracking-tight">Smart Spend</Link>
        <nav className="hidden items-center gap-4 md:flex">
          <a href="#features" className="text-sm">Features</a>
          <a href="#how" className="text-sm">How it works</a>
          <a href="#pricing" className="text-sm">Pricing</a>
          <Button asChild variant="ghost">
            <Link to={user ? '/dashboard' : '/login'}>
              {user ? 'Open dashboard' : 'Log in'}
            </Link>
          </Button>
        </nav>
        <div className="md:hidden">
          <button aria-label="menu" onClick={() => setOpen(v => !v)} className="p-2">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 6h16M4 12h16M4 18h16" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>
      </div>
      {open && (
        <div className="mt-2 rounded-lg p-4 shadow-lg bg-popover glass md:hidden">
          <a href="#features" className="block py-2">Features</a>
          <a href="#how" className="block py-2">How it works</a>
          <a href="#pricing" className="block py-2">Pricing</a>
          <Link to={user ? '/dashboard' : '/login'} className="block py-2 font-semibold">{user ? 'Open dashboard' : 'Log in'}</Link>
        </div>
      )}
    </header>
  )
}
