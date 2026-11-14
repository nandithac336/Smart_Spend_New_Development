import { ArrowUpRight, Banknote, CreditCard, Landmark, Pencil, Smartphone, Wallet as WalletIcon, Archive } from 'lucide-react'
import { m } from 'motion/react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button.jsx'
import CountUp from '@/components/motion/CountUp.jsx'
import { useMotionDisabled } from '@/hooks/useMotionDisabled.js'

const walletTypes = {
  cash: { label: 'Cash', Icon: Banknote, accent: 'cash' },
  bank: { label: 'Bank account', Icon: Landmark, accent: 'bank' },
  upi: { label: 'UPI', Icon: Smartphone, accent: 'upi' },
  card: { label: 'Card', Icon: CreditCard, accent: 'card' },
}

function WalletCard({ wallet, onEdit, onArchive }) {
  const motionDisabled = useMotionDisabled()
  const { label, Icon, accent } = walletTypes[wallet.type] ?? {
    label: wallet.type,
    Icon: WalletIcon,
    accent: 'other',
  }

  return (
    <m.article
      animate={{ opacity: 1, y: 0 }}
      className={`wallet-card glass-flat wallet-card-${accent} relative flex min-h-56 flex-col overflow-hidden rounded-2xl p-5 sm:p-6`}
      initial={motionDisabled ? false : { opacity: 0, y: 10 }}
      transition={{ duration: motionDisabled ? 0 : 0.22, ease: 'easeOut' }}
    >
      <span aria-hidden="true" className="wallet-card-orbit" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="wallet-card-icon flex size-12 shrink-0 items-center justify-center rounded-2xl">
            <Icon aria-hidden="true" className="size-5" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold tracking-tight">{wallet.name}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{label}</p>
          </div>
        </div>
        {wallet.isDefault && <span className="wallet-default-badge rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide">Default</span>}
      </div>

      <div className="relative mt-auto border-t border-border/70 pt-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Available balance</p>
        <p className="mt-1.5 text-2xl font-bold tracking-tight sm:text-[1.75rem]">
          <CountUp currency value={wallet.balance ?? 0} />
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <Link
            aria-label={`View activity for ${wallet.name}`}
            className="wallet-activity-link inline-flex min-h-9 items-center gap-1.5 text-xs font-semibold"
            to={`/transactions?walletId=${encodeURIComponent(wallet.id ?? wallet._id)}`}
          >
            View activity <ArrowUpRight aria-hidden="true" className="size-3.5" />
          </Link>
          <div className="flex items-center gap-1">
            <Button aria-label={`Edit ${wallet.name}`} className="size-9" onClick={() => onEdit(wallet)} size="icon" variant="ghost">
              <Pencil aria-hidden="true" />
            </Button>
            {!wallet.isDefault && (
              <Button aria-label={`Archive ${wallet.name}`} className="size-9" onClick={() => onArchive(wallet)} size="icon" variant="ghost">
                <Archive aria-hidden="true" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </m.article>
  )
}

export default WalletCard
