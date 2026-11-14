import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth.js'
import ThemeToggle from '@/components/common/ThemeToggle.jsx'
import Sidebar from './Sidebar.jsx'
import BottomNav from './BottomNav.jsx'
import AddButton from './AddButton.jsx'
import { useCategories } from '@/hooks/useCategories.js'
import { useWallets } from '@/hooks/useWallets.js'
import PageTransition from '@/components/motion/PageTransition.jsx'
import { MessageCircle, ShieldAlert, TrendingUp, WalletCards } from 'lucide-react'
import { Button } from '@/components/ui/button.jsx'
import OfflineStatus from '@/components/offline/OfflineStatus.jsx'
import { useOfflineSyncManager } from '@/hooks/useOfflineSync.js'
import { useOfflineReferenceData } from '@/hooks/useOfflineReferenceData.js'

function AppShell() {
  const { user } = useAuth()
  const userId = user?.id ?? user?._id
  useOfflineSyncManager(userId)
  const isDashboard = useLocation().pathname === '/dashboard'
  const expenseCategories = useCategories('expense')
  const incomeCategories = useCategories('income')
  const walletQuery = useWallets()
  useOfflineReferenceData(userId, 'wallets', walletQuery.data?.wallets)
  useOfflineReferenceData(userId, 'categories-expense', expenseCategories.data)
  useOfflineReferenceData(userId, 'categories-income', incomeCategories.data)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    function handleScroll() {
      setScrolled(window.scrollY > 8)
    }
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div className={`min-h-screen ${isDashboard ? 'dashboard-app-shell' : ''}`}>
      <Sidebar user={user} />
      <div className="min-h-screen lg:pl-72">
        <main className="mx-auto min-h-screen w-full max-w-6xl px-4 pt-6 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6 sm:pt-8 lg:px-10 lg:pb-28">
          <OfflineStatus />
          <header className={`sticky top-0 z-20 -mx-4 mb-5 flex h-14 items-center justify-between px-4 transition-colors sm:-mx-6 sm:px-6 lg:hidden ${scrolled ? 'border-b border-border/70 bg-background/85 backdrop-blur-xl' : 'border-b border-transparent bg-transparent'}`}>
            <Link aria-label="SmartSpend dashboard" className="flex items-center gap-2.5 text-sm font-bold tracking-tight" to="/dashboard">
              <span className="sidebar-brand-mark sidebar-brand-mark-compact">
                <WalletCards aria-hidden="true" className="size-4" />
              </span>
              <span>Smart<span className="text-primary">Spend</span></span>
            </Link>
            <div className="flex items-center gap-2">
              <Button asChild className="h-9 px-2.5 text-xs" variant="outline">
                <Link aria-label="Ask Spart" to="/ask-spart"><MessageCircle aria-hidden="true" />Ask Spart</Link>
              </Button>
              <Button asChild className="size-9" size="icon" variant="outline">
                <Link aria-label="Anomaly detection" to="/anomalies"><ShieldAlert aria-hidden="true" /></Link>
              </Button>
              <Button asChild className="size-9" size="icon" variant="outline">
                <Link aria-label="Expense Predictions" to="/predictions"><TrendingUp aria-hidden="true" /></Link>
              </Button>
              <ThemeToggle compact />
            </div>
          </header>
          <PageTransition />
        </main>
      </div>
      <BottomNav />
      <AddButton />
    </div>
  )
}

export default AppShell
