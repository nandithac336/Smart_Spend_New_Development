import React from 'react'
import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="mt-12 border-t border-border bg-transparent py-8">
      <div className="mx-auto max-w-6xl px-4 text-center">
        <div className="mb-4 flex items-center justify-center gap-4">
          <Link to="/">Smart Spend</Link>
        </div>
        <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} Smart Spend — Made with care.</p>
      </div>
    </footer>
  )
}
