import { ArrowRight, Banknote, CreditCard, Landmark, Smartphone, TrendingUp, Wallet as WalletIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import Amount from '@/components/common/Amount.jsx'

const walletTypes = {
  cash: { label: 'Cash', Icon: Banknote },
  bank: { label: 'Bank', Icon: Landmark },
  upi: { label: 'UPI', Icon: Smartphone },
  card: { label: 'Card', Icon: CreditCard },
}

function SummaryCard({ label, value, icon: Icon, type = 'neutral', detail, animated }) {
  return (
    <article className="dashboard-kpi dashboard-enter-item min-w-0 rounded-2xl p-4 sm:p-5">
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className="dashboard-icon-badge flex size-8 items-center justify-center rounded-xl">
          <Icon aria-hidden="true" className="size-4" />
        </span>
        <h2 className="truncate text-xs font-medium sm:text-sm">{label}</h2>
      </div>
      <Amount animated={animated} className="mt-4 block truncate text-xl sm:text-2xl" type={type} value={value} />
      {detail && <p className="mt-2 text-xs text-muted-foreground">{detail}</p>}
    </article>
  )
}

export function DashboardSummary({
  data,
  animated,
  periodLabel = 'this month',
  selectedDate,
  todayDate,
}) {
  const wallets = data.wallets ?? []
  const selectedDateText = selectedDate
    ? new Intl.DateTimeFormat('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    }).format(new Date(`${selectedDate}T00:00:00.000Z`))
    : 'today'
  const selectedDateDetail = selectedDate === todayDate ? 'Spent today' : `Spent ${selectedDateText}`
  const monthNet = Number.isFinite(Number(data.monthNet))
    ? Number(data.monthNet)
    : Number(data.monthIncome || 0) - Number(data.monthSpent || 0)

  return (
    <section aria-label="Financial summary" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <article className="dashboard-hero-card dashboard-enter-item col-span-2 overflow-hidden rounded-2xl p-5 sm:p-7">
        <div className="relative z-10 flex min-h-32 flex-col justify-between gap-6 sm:min-h-36">
          <div className="flex items-center gap-2 text-sm text-white/75">
            <WalletIcon aria-hidden="true" className="size-4" />
            <h2 className="font-medium">Total balance</h2>
          </div>
          <div>
            <Amount animated={animated} className="block text-3xl font-bold tracking-tight text-white sm:text-4xl" value={data.totalBalance ?? 0} />
            <p className="mt-2 text-xs text-white/65">
              Across {wallets.length} {wallets.length === 1 ? 'wallet' : 'wallets'}
            </p>
          </div>
        </div>
      </article>
      <SummaryCard
        animated={animated}
        detail={selectedDateDetail}
        icon={Banknote}
        label={selectedDate === todayDate || !selectedDate ? 'Today’s expenses' : 'Expenses on selected date'}
        type="expense"
        value={data.selectedDateSpent ?? data.todaySpent ?? 0}
      />
      <SummaryCard
        animated={animated}
        detail={periodLabel}
        icon={CreditCard}
        label="Expenses"
        type="expense"
        value={data.monthSpent ?? 0}
      />
      <SummaryCard
        animated={animated}
        detail={(
          <span>
            Net in {periodLabel}{' '}
            <Amount
              animated={animated}
              className="ml-1 text-xs"
              type={monthNet > 0 ? 'income' : monthNet < 0 ? 'expense' : 'neutral'}
              value={monthNet}
            />
          </span>
        )}
        icon={TrendingUp}
        label={`Income · ${periodLabel}`}
        type="income"
        value={data.monthIncome ?? 0}
      />
    </section>
  )
}

export function DashboardWallets({ wallets, animated, motionDisabled }) {
  return (
    <section aria-labelledby="dashboard-wallets-heading">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold" id="dashboard-wallets-heading">Your Current Wallets</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Balances across your accounts</p>
        </div>
        <Link className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline" to="/wallets">
          All wallets <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </div>
      {wallets.length > 0 ? (
        <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-3 lg:overflow-visible lg:px-0 xl:grid-cols-4">
          {wallets.map((wallet, index) => {
            const walletType = walletTypes[wallet.type] ?? { label: wallet.type || 'Wallet', Icon: WalletIcon }
            const { Icon } = walletType
            return (
              <article
                className={`dashboard-wallet-card dashboard-enter-item min-w-48 snap-start rounded-2xl p-4 sm:min-w-56 lg:min-w-0 ${motionDisabled ? '' : 'wallet-tilt glass-card-lift'}`}
                key={wallet.id ?? wallet._id}
                style={{ '--dashboard-delay': `${Math.min(index, 5) * 55}ms` }}
              >
                <div className="flex items-center gap-3">
                  <span className="dashboard-icon-badge flex size-10 shrink-0 items-center justify-center rounded-xl">
                    <Icon aria-hidden="true" className="size-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{wallet.name}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{walletType.label}</span>
                  </span>
                </div>
                <Amount animated={animated} className="mt-4 block truncate text-lg" value={wallet.balance ?? 0} />
              </article>
            )
          })}
        </div>
      ) : (
        <div className="dashboard-empty-card flex items-center justify-between gap-4 rounded-2xl p-4">
          <p className="text-sm text-muted-foreground">Add a wallet to see your account balances here.</p>
          <Link className="shrink-0 text-sm font-semibold text-primary hover:underline" to="/wallets">Add wallet</Link>
        </div>
      )}
    </section>
  )
}
