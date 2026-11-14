import { useState } from 'react'
import { AnimatePresence, m } from 'motion/react'
import {
  Plus,
  Wallet as WalletIcon,
  ArrowLeftRight,
  ArrowUpRight,
  Layers3,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import EmptyState from '@/components/common/EmptyState.jsx'
import ErrorState from '@/components/common/ErrorState.jsx'
import TransferForm from '@/components/wallets/TransferForm.jsx'
import WalletForm from '@/components/wallets/WalletForm.jsx'
import WalletCard from '@/components/wallets/WalletCard.jsx'
import '@/components/wallets/Wallets.css'
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog.jsx'
import { Button } from '@/components/ui/button.jsx'
import { useWalletMutations } from '@/hooks/useWalletMutations.js'
import { useMotionDisabled } from '@/hooks/useMotionDisabled.js'
import { useWallets } from '@/hooks/useWallets.js'
import { formatINR } from '@/lib/money.js'

function walletId(wallet) {
  return wallet.id ?? wallet._id
}

function Wallets() {
  const { data: walletData, isLoading, isError, refetch } = useWallets()
  const motionDisabled = useMotionDisabled()
  const wallets = walletData?.wallets ?? []
  const totalBalance = walletData?.totalBalance
  const mutations = useWalletMutations()
  const [transferBalanceSnapshot, setTransferBalanceSnapshot] = useState(null)
  const [isAdding, setIsAdding] = useState(false)
  const [isTransferring, setIsTransferring] = useState(false)
  const [editingWallet, setEditingWallet] = useState(null)
  const [archivingWallet, setArchivingWallet] = useState(null)
  const displayedWallets = transferBalanceSnapshot
    ? wallets.map((wallet) => ({
      ...wallet,
      balance: transferBalanceSnapshot.balances.get(walletId(wallet)) ?? wallet.balance,
    }))
    : wallets
  const displayedTotalBalance = transferBalanceSnapshot?.totalBalance ?? totalBalance

  function openTransfer() {
    setTransferBalanceSnapshot({
      totalBalance,
      balances: new Map(wallets.map((wallet) => [walletId(wallet), wallet.balance])),
    })
    setIsTransferring(true)
  }

  function archiveSelectedWallet() {
    if (!archivingWallet) return
    mutations.archive.mutate(walletId(archivingWallet), {
      onSuccess: () => setArchivingWallet(null),
    })
  }

  return (
    <>
      <div className="wallets-page space-y-6">
        <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">Your accounts</p>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">My Wallets</h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">
              Manage the places you keep money and move funds between them.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button className="min-h-10" onClick={openTransfer} variant="outline">
              <ArrowLeftRight aria-hidden="true" />
              Transfer money
            </Button>
            <Button className="min-h-10" onClick={() => setIsAdding(true)}>
              <Plus aria-hidden="true" />
              Add wallet
            </Button>
          </div>
        </header>

        <section aria-label="Wallet overview" className="wallets-overview grid gap-5 rounded-2xl p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-7">
          <div aria-label="Total balance">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Total balance</p>
            {isLoading ? (
              <div aria-label="Loading total balance" className="mt-3 h-10 w-48 animate-pulse rounded-lg bg-muted" />
            ) : (
              <p className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
                {isError ? '—' : formatINR(displayedTotalBalance ?? 0, { minimumFractionDigits: 2 })}
              </p>
            )}
            <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <ArrowLeftRight aria-hidden="true" className="size-3.5 text-primary" />
              Transfers move money between wallets, not into spending.
            </p>
          </div>
          <div className="flex items-center gap-3 border-t border-border/70 pt-4 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
            <span className="wallet-summary-icon flex size-11 shrink-0 items-center justify-center rounded-xl">
              <Layers3 aria-hidden="true" className="size-5" />
            </span>
            <div>
              <p className="text-2xl font-bold tabular-nums">{isLoading || isError ? '—' : wallets.length}</p>
              <p className="text-xs text-muted-foreground">Active wallets</p>
            </div>
            {!isLoading && !isError && wallets.length > 0 && (
              <Link aria-label="View all transactions" className="ml-2 inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" to="/transactions">
                <ArrowUpRight aria-hidden="true" className="size-4" />
              </Link>
            )}
          </div>
        </section>

      {isLoading ? (
        <div aria-label="Loading wallets" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div className="glass-flat h-56 animate-pulse rounded-2xl" key={index} />
          ))}
        </div>
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} title="Could not load wallets" />
      ) : wallets.length === 0 ? (
        <EmptyState
          action={<Button onClick={() => setIsAdding(true)}><Plus aria-hidden="true" />Add wallet</Button>}
          description="Add a wallet to keep your balances organized."
          icon={WalletIcon}
          title="No wallets yet"
        />
      ) : (
        <AnimatePresence initial={!motionDisabled}>
          <m.div
            animate="visible"
            className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
            initial={motionDisabled ? false : 'hidden'}
            layout
            variants={{ hidden: {}, visible: { transition: { staggerChildren: motionDisabled ? 0 : 0.07 } } }}
          >
            {displayedWallets.map((wallet) => (
              <WalletCard
                key={walletId(wallet)}
                onArchive={setArchivingWallet}
                onEdit={setEditingWallet}
                wallet={wallet}
              />
            ))}
          </m.div>
        </AnimatePresence>
      )}

      {isAdding && <WalletForm mutations={mutations} onClose={() => setIsAdding(false)} />}
      {editingWallet && <WalletForm key={walletId(editingWallet)} mutations={mutations} onClose={() => setEditingWallet(null)} wallet={editingWallet} />}
      {isTransferring && (
        <TransferForm
          mutations={mutations}
          onClose={() => {
            setIsTransferring(false)
            setTransferBalanceSnapshot(null)
          }}
          onTransferAnimationComplete={() => setTransferBalanceSnapshot(null)}
          wallets={wallets}
        />
      )}

      <AlertDialog onOpenChange={(open) => { if (!open && !mutations.archive.isPending) setArchivingWallet(null) }} open={Boolean(archivingWallet)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this wallet?</AlertDialogTitle>
            <AlertDialogDescription>
              {archivingWallet && `“${archivingWallet.name}” will be removed from your wallet list.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutations.archive.isPending}>Cancel</AlertDialogCancel>
            <Button disabled={mutations.archive.isPending} onClick={archiveSelectedWallet} variant="destructive">
              {mutations.archive.isPending ? 'Archiving…' : 'Archive wallet'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </>
  )
}

export default Wallets
