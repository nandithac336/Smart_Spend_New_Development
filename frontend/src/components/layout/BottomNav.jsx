import { LayoutDashboard, Settings, Wallet, ReceiptText, ChartPie, Target, Repeat2, ChartNoAxesCombined, CalendarClock, HeartPulse, Bell } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { m } from 'motion/react'
import AddButton from './AddButton.jsx'
import { useMotionDisabled } from '@/hooks/useMotionDisabled.js'
import { useUnreadNotificationCount } from '@/hooks/useNotifications.js'

const leftLinks = [
  { to: '/dashboard', label: 'Dashboard', compactLabel: 'Home', icon: LayoutDashboard },
  { to: '/transactions', label: 'Transactions', compactLabel: 'Activity', icon: ReceiptText },
  { to: '/budgets', label: 'Budgets', compactLabel: 'Budget', icon: ChartPie },
  { to: '/recurring', label: 'Recurring', compactLabel: 'Repeat', icon: Repeat2 },
]

const rightLinks = [
  { to: '/analytics', label: 'Analytics', compactLabel: 'Insights', icon: ChartNoAxesCombined },
  { to: '/financial-health', label: 'Financial Health', compactLabel: 'Health', icon: HeartPulse },
  { to: '/notifications', label: 'Notifications', compactLabel: 'Alerts', icon: Bell },
  { to: '/goals', label: 'Savings Goals', compactLabel: 'Goals', icon: Target },
  { to: '/wallets', label: 'Wallets', icon: Wallet },
  { to: '/subscriptions', label: 'Subscriptions', compactLabel: 'Subs', icon: CalendarClock },
  { to: '/settings', label: 'Settings', icon: Settings },
]

function BottomNav() {
  const motionDisabled = useMotionDisabled()
  const unread = useUnreadNotificationCount()

  function renderLink({ to, label, compactLabel, icon: Icon }) {
    return (
      <NavLink
        aria-label={label}
        className={({ isActive }) => `relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[8px] font-semibold tracking-tight transition-colors sm:text-[10px] ${isActive ? 'text-primary' : 'text-muted-foreground'}`}
        end={to === '/dashboard'}
        key={to}
        to={to}
      >
        {({ isActive }) => (
          <>
            {isActive && (
              <m.span
                className="absolute -top-2 h-1 w-7 rounded-full bg-primary"
                layoutId="bottom-nav-active-indicator"
                transition={motionDisabled ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 36 }}
              />
            )}
            <Icon aria-hidden="true" className="size-[18px] sm:size-5" />
            {to === '/notifications' && unread.data > 0 && (
              <span aria-label={`${unread.data} unread`} className="absolute top-0 right-[calc(50%-1.25rem)] min-w-4 rounded-full bg-primary px-1 text-[9px] leading-4 text-primary-foreground">
                {unread.data > 99 ? '99+' : unread.data}
              </span>
            )}
            <span className="max-w-full truncate">
              {compactLabel ? (
                <>
                  <span className="sm:hidden">{compactLabel}</span>
                  <span className="hidden sm:inline">{label}</span>
                </>
              ) : label}
            </span>
          </>
        )}
      </NavLink>
    )
  }

  return (
    <nav aria-label="Main navigation" className="fixed inset-x-0 bottom-2 z-40 px-2 pb-[max(env(safe-area-inset-bottom),0.25rem)] sm:bottom-3 sm:px-3 lg:hidden">
      <div className="glass-strong mx-auto flex h-[4.35rem] max-w-lg items-center justify-around gap-0 rounded-[1.45rem] px-1 shadow-[0_14px_38px_rgb(3_5_18/30%)] sm:px-2">
        {leftLinks.map(renderLink)}
        <div className="flex flex-1 justify-center">
          <AddButton placement="nav" />
        </div>
        {rightLinks.map(renderLink)}
      </div>
    </nav>
  )
}

export default BottomNav
