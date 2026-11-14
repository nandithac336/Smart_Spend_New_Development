import { LayoutDashboard, Settings, Wallet, ReceiptText, WalletCards, ChartPie, Target, Repeat2, ChartNoAxesCombined, FileSpreadsheet, Sparkles, MessageCircle, ShieldAlert, TrendingUp, CalendarClock, HeartPulse, Bell, Cloud } from 'lucide-react'
import { NavLink, Link } from 'react-router-dom'
import { m } from 'motion/react'
import ThemeToggle from '@/components/common/ThemeToggle.jsx'
import LogoutButton from './LogoutButton.jsx'
import { useMotionDisabled } from '@/hooks/useMotionDisabled.js'
import { useUnreadNotificationCount } from '@/hooks/useNotifications.js'

const links = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/transactions', label: 'Transactions', icon: ReceiptText },
  { to: '/categorization', label: 'Categorization', icon: Sparkles },
  { to: '/ask-spart', label: 'Ask Spart', icon: MessageCircle },
  { to: '/anomalies', label: 'Anomalies', icon: ShieldAlert },
  { to: '/imports', label: 'Import statement', icon: FileSpreadsheet },
  { to: '/wallets', label: 'Wallets', icon: Wallet },
  { to: '/budgets', label: 'Budgets', icon: ChartPie },
  { to: '/goals', label: 'Savings Goals', icon: Target },
  { to: '/recurring', label: 'Recurring', icon: Repeat2 },
  { to: '/analytics', label: 'Analytics', icon: ChartNoAxesCombined },
  { to: '/predictions', label: 'Expense Predictions', icon: TrendingUp },
  { to: '/subscriptions', label: 'Subscriptions', icon: CalendarClock },
  { to: '/financial-health', label: 'Financial Health', icon: HeartPulse },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/sync', label: 'Sync Centre', icon: Cloud },
  { to: '/settings', label: 'Settings', icon: Settings },
]

function Sidebar({ user }) {
  const motionDisabled = useMotionDisabled()
  const unread = useUnreadNotificationCount()

  return (
    <aside className="sidebar-shell fixed inset-y-0 left-0 z-30 hidden w-72 flex-col px-5 py-6 lg:flex">
      <Link aria-label="SmartSpend dashboard" className="group flex items-center gap-3 px-2" to="/dashboard">
        <span className="sidebar-brand-mark">
          <WalletCards aria-hidden="true" className="size-5" />
        </span>
        <span className="text-[17px] font-bold tracking-[-0.04em] text-foreground">
          Smart<span className="text-primary">Spend</span>
        </span>
      </Link>

      <nav aria-label="Main navigation" className="mt-10 max-h-[calc(100vh-13rem)] space-y-1.5 overflow-y-auto">
        <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/75">
          Workspace
        </p>
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            aria-label={label}
            className={({ isActive }) => `group relative flex min-h-11 items-center gap-3 overflow-hidden rounded-xl px-3 text-[13px] font-medium transition-[color,background-color] duration-200 focus-visible:outline-none ${isActive ? 'text-primary' : 'text-muted-foreground hover:bg-accent/55 hover:text-foreground'}`}
            end={to === '/dashboard'}
            key={to}
            to={to}
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <m.span
                    className="absolute inset-0 rounded-xl border border-primary/15 bg-primary/10"
                    layoutId="sidebar-active-pill"
                    transition={motionDisabled ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 38 }}
                  />
                )}
                <span className={`relative z-10 flex size-8 items-center justify-center rounded-lg transition-colors ${isActive ? 'bg-primary/15 text-primary' : 'text-muted-foreground group-hover:text-foreground'}`}>
                  <Icon aria-hidden="true" className="size-[17px]" />
                </span>
                <span className="relative z-10">{label}</span>
                {to === '/notifications' && unread.data > 0 && (
                  <span aria-label={`${unread.data} unread`} className={`relative z-10 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground ${isActive ? '' : 'ml-auto'}`}>
                    {unread.data > 99 ? '99+' : unread.data}
                  </span>
                )}
                {isActive && <span aria-hidden="true" className="relative z-10 ml-auto size-1.5 rounded-full bg-primary shadow-[0_0_10px_var(--primary)]" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto space-y-5">
        <ThemeToggle />
        <div className="flex items-center gap-3 border-t border-sidebar-border pt-5">
          <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/25 to-accent-teal/20 text-sm font-semibold text-primary ring-1 ring-primary/15">
            {user?.name?.trim()?.charAt(0)?.toUpperCase() || '?'}
          </span>
          <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground" title={user?.name}>
            {user?.name || 'Account'}
          </span>
          <LogoutButton aria-label="Log out" className="size-9 px-0 text-muted-foreground hover:text-destructive" showLabel={false} title="Log out" />
        </div>
      </div>
    </aside>
  )
}

export default Sidebar
