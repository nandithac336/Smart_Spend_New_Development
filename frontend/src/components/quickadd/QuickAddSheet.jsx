import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, m, useDragControls } from 'motion/react'
import { ArrowDownLeft, ArrowUpRight, Check, LoaderCircle } from 'lucide-react'
import { toast } from 'sonner'
import { useMotionDisabled } from '@/hooks/useMotionDisabled.js'
import { Button } from '@/components/ui/button.jsx'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet.jsx'
import { useCategories } from '@/hooks/useCategories.js'
import { useTransactionMutations } from '@/hooks/useTransactionMutations.js'
import { useTransactions } from '@/hooks/useTransactions.js'
import { useWallets } from '@/hooks/useWallets.js'
import { useAuth } from '@/hooks/useAuth.js'
import { useOfflineReferenceData } from '@/hooks/useOfflineReferenceData.js'
import CategoryCreator from '@/components/categories/CategoryCreator.jsx'
import { formatINR, fromPaise, toPaise } from '@/lib/money.js'
import NumberPad from './NumberPad.jsx'
import { buildQuickAddFavorites } from './quickAddUtils.js'

const MAX_AMOUNT_PAISE = 10_000_000_000
const LAST_WALLET_KEY = 'smart-spend:last-wallet-id'
const EMPTY_CATEGORIES = []
const paymentMethods = [
  ['cash', 'Cash'],
  ['upi', 'UPI'],
  ['debit_card', 'Debit card'],
  ['credit_card', 'Credit card'],
  ['net_banking', 'Net banking'],
]

function idOf(record) {
  return record?.id ?? record?._id
}

function localDateTime(value = new Date()) {
  const offset = value.getTimezoneOffset() * 60_000
  return new Date(value.getTime() - offset).toISOString().slice(0, 16)
}

function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.matchMedia?.('(max-width: 639px)').matches ?? false)
  useEffect(() => {
    if (!window.matchMedia) return undefined
    const media = window.matchMedia('(max-width: 639px)')
    const update = () => setMobile(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  return mobile
}

function QuickAddSheet({ open, onOpenChange }) {
  const isMobile = useIsMobile()
  const motionDisabled = useMotionDisabled()
  const dragControls = useDragControls()
  const mutations = useTransactionMutations()
  const { user } = useAuth()
  const userId = user?.id ?? user?._id
  const walletQuery = useWallets()
  const walletData = walletQuery.data?.wallets ?? (
    Array.isArray(walletQuery.data) ? walletQuery.data : undefined
  )
  const cachedWallets = useOfflineReferenceData(userId, 'wallets', walletData)
  const wallets = walletData ?? cachedWallets.data ?? []
  const fallbackWallet = wallets.find((wallet) => wallet.isDefault) ?? wallets[0]
  const lastWalletId = window.localStorage.getItem(LAST_WALLET_KEY)
  const preferredWallet = wallets.find((wallet) => idOf(wallet) === lastWalletId) ?? fallbackWallet
  const initialWalletId = preferredWallet ? idOf(preferredWallet) : ''
  const [type, setType] = useState('expense')
  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [walletId, setWalletId] = useState(initialWalletId)
  const [txnDate, setTxnDate] = useState(() => localDateTime())
  const [paymentMethod, setPaymentMethod] = useState(() => preferredWallet?.type === 'upi'
    ? 'upi'
    : preferredWallet?.type === 'bank'
      ? 'net_banking'
      : preferredWallet?.type === 'card'
        ? 'debit_card'
        : 'cash')
  const [merchant, setMerchant] = useState('')
  const [note, setNote] = useState('')
  const [moreOpen, setMoreOpen] = useState(false)
  const [clientId, setClientId] = useState(() => window.crypto.randomUUID())
  const [saveError, setSaveError] = useState('')
  const [amountMotionKey, setAmountMotionKey] = useState(0)
  const [amountShakeKey, setAmountShakeKey] = useState(0)
  const [amountBounceKey, setAmountBounceKey] = useState(0)
  const [savePhase, setSavePhase] = useState('idle')
  const categoriesQuery = useCategories(type)
  const cachedCategories = useOfflineReferenceData(userId, `categories-${type}`, categoriesQuery.data)
  const categories = categoriesQuery.data ?? cachedCategories.data ?? EMPTY_CATEGORIES
  const { data: recentData } = useTransactions({ type, limit: 100 })
  const { data: expenseRecentData } = useTransactions({ type: 'expense', limit: 100 })
  const recentTransactions = useMemo(
    () => recentData?.pages?.flatMap((page) => page.data ?? []) ?? [],
    [recentData],
  )
  const recentExpenses = useMemo(
    () => expenseRecentData?.pages?.flatMap((page) => page.data ?? []) ?? [],
    [expenseRecentData],
  )

  const recentCategoryCounts = useMemo(() => {
    const counts = new Map()
    for (const transaction of recentTransactions) {
      if (transaction.type !== type) continue
      const categoryId = idOf(transaction.categoryId)
      if (categoryId) counts.set(categoryId, (counts.get(categoryId) ?? 0) + 1)
    }
    return counts
  }, [recentTransactions, type])
  const sortedCategories = useMemo(() => [...categories].sort(
    (left, right) => (recentCategoryCounts.get(idOf(right)) ?? 0) - (recentCategoryCounts.get(idOf(left)) ?? 0),
  ), [categories, recentCategoryCounts])
  // There is no favorites endpoint yet; derive frequent combinations from the last 100 real transactions.
  const favorites = useMemo(() => buildQuickAddFavorites(recentExpenses), [recentExpenses])
  const parsedPaise = toPaise(amount)
  const validAmount = parsedPaise !== null && parsedPaise > 0 && parsedPaise <= MAX_AMOUNT_PAISE
  const savedAmountLabel = validAmount ? formatINR(parsedPaise) : formatINR(0, { minimumFractionDigits: 2 })
  const maxDate = localDateTime()
  const sheetMotionProps = {
    initial: motionDisabled
      ? { opacity: 0 }
      : isMobile
        ? { y: '100%' }
        : { opacity: 0, scale: 0.96 },
    animate: motionDisabled
      ? { opacity: 1 }
      : isMobile
        ? { y: 0 }
        : { opacity: 1, scale: 1 },
    transition: motionDisabled
      ? { duration: 0.12 }
      : isMobile
        ? { type: 'spring', stiffness: 480, damping: 42, mass: 0.72 }
        : { duration: 0.14, ease: 'easeOut' },
    drag: isMobile && !motionDisabled ? 'y' : false,
    dragControls,
    dragListener: false,
    dragConstraints: { top: 0, bottom: 260 },
    dragElastic: { top: 0, bottom: 0.28 },
    dragMomentum: false,
    onDragEnd: (_, info) => {
      if (isMobile && (info.offset.y > 100 || info.velocity.y > 550)) onOpenChange(false)
    },
  }

  const applyNumberKey = useCallback((key) => {
    setSaveError('')
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(8)
    }
    if (key === 'backspace') {
      setAmount((current) => current.slice(0, -1))
      setAmountMotionKey((current) => current + 1)
      return
    }
    if (key === '.') {
      if (amount.includes('.')) {
        setAmountShakeKey((shake) => shake + 1)
        return
      }
      setAmount(`${amount || '0'}.`)
      setAmountMotionKey((motionKey) => motionKey + 1)
      return
    }
    if (amount.includes('.') && amount.split('.')[1].length >= 2) {
      setAmountShakeKey((shake) => shake + 1)
      return
    }
    const next = amount === '0' ? key : `${amount}${key}`
    const nextPaise = toPaise(next)
    if (nextPaise !== null && nextPaise <= MAX_AMOUNT_PAISE) {
      setAmount(next)
      setAmountMotionKey((motionKey) => motionKey + 1)
    } else {
      setAmountShakeKey((shake) => shake + 1)
    }
  }, [amount])

  useEffect(() => {
    if (!open) return undefined
    function onKeyDown(event) {
      if (event.altKey || event.ctrlKey || event.metaKey) return
      const target = event.target
      const isEditing = target instanceof HTMLElement && (
        target.isContentEditable || target.matches('input, textarea, select')
      )
      if (isEditing) return

      if (/^\d$/.test(event.key) || event.key === '.' || event.key === 'Backspace') {
        event.preventDefault()
        applyNumberKey(event.key === 'Backspace' ? 'backspace' : event.key)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [applyNumberKey, open])

  function chooseWallet(nextId) {
    setWalletId(nextId)
    const wallet = wallets.find((item) => idOf(item) === nextId)
    if (wallet?.type === 'upi') setPaymentMethod('upi')
    else if (wallet?.type === 'cash') setPaymentMethod('cash')
    else if (wallet?.type === 'bank') setPaymentMethod('net_banking')
    else if (wallet?.type === 'card') setPaymentMethod('debit_card')
  }

  function applyFavorite(favorite) {
    setAmount(fromPaise(favorite.amount).toFixed(2).replace(/\.?0+$/, ''))
    setCategoryId(favorite.categoryId)
    setMerchant(favorite.merchant)
    setType('expense')
  }

  function showUndoToast(response, amountPaise, category) {
    if (response?.pendingSync) {
      toast('Saved offline; pending sync')
      return
    }
    const transaction = response?.data
    const transactionId = idOf(transaction)
    const message = `${formatINR(amountPaise)} added to ${category?.name ?? (type === 'income' ? 'Income' : 'Expense')}`
    const toastOptions = {
      duration: 6000,
      ...(transactionId ? {
        action: {
          label: 'Undo',
          onClick: () => mutations.remove.mutate(transactionId),
        },
      } : {}),
    }
    if (response?.duplicate) toast('Already saved', toastOptions)
    else toast(message, toastOptions)
  }

  async function save(keepOpen) {
    setSaveError('')
    if (!validAmount || !categoryId || !walletId || !clientId || savePhase !== 'idle') return
    const category = categories.find((item) => idOf(item) === categoryId)
    const amountPaise = parsedPaise
    setSavePhase('saving')
    try {
      const response = await mutations.create.mutateAsync({
        type,
        amount: amountPaise,
        walletId,
        categoryId,
        ...(merchant.trim() ? { merchant: merchant.trim() } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
        paymentMethod,
        txnDate: new Date(txnDate).toISOString(),
        clientId,
        source: 'quickadd',
      })
      window.localStorage.setItem(LAST_WALLET_KEY, walletId)
      window.localStorage.setItem('smart-spend:has-saved-transaction', 'true')
      window.dispatchEvent(new Event('smart-spend:transaction-saved'))
      if (keepOpen) {
        setSavePhase('saved')
        window.setTimeout(() => {
          showUndoToast(response, amountPaise, category)
          setAmount('')
          setAmountMotionKey((key) => key + 1)
          setAmountBounceKey((key) => key + 1)
          setClientId(window.crypto.randomUUID())
          setSavePhase('idle')
        }, 130)
      } else {
        setSavePhase('saved')
        window.setTimeout(() => {
          onOpenChange(false)
          window.setTimeout(() => showUndoToast(response, amountPaise, category), 170)
        }, 120)
      }
    } catch (error) {
      setSavePhase('idle')
      setSaveError(error?.response?.data?.error?.message ?? error?.response?.data?.message ?? error?.message ?? 'Could not save transaction. Please try again.')
    }
  }

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent
        className={`glass-flat border-border p-4 sm:p-6 ${isMobile
          ? 'max-h-[92dvh] rounded-t-3xl pb-[max(1rem,env(safe-area-inset-bottom))]'
          : 'w-full sm:max-w-md lg:w-[460px] lg:max-w-none'}`}
        motionProps={sheetMotionProps}
        side={isMobile ? 'bottom' : 'right'}
        showCloseButton
      >
        <SheetHeader className="px-0 pr-10 pt-1">
          {isMobile && (
            <div
              aria-hidden="true"
              className="mx-auto mb-2 h-1.5 w-10 touch-none rounded-full bg-muted-foreground/30"
              onPointerDown={(event) => {
                if (!motionDisabled) dragControls.start(event)
              }}
            />
          )}
          <SheetTitle className="text-xl">Quick add</SheetTitle>
          <SheetDescription>Enter an amount, choose a category, and save.</SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pb-1">
          <div aria-label="Transaction type" className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
            {['expense', 'income'].map((value) => (
              <Button
                aria-pressed={type === value}
                className={type === value ? 'bg-background shadow-sm' : 'text-muted-foreground'}
                key={value}
                onClick={() => {
                  setType(value)
                  setCategoryId('')
                  setSaveError('')
                }}
                type="button"
                variant="ghost"
              >
                {value === 'expense' ? <ArrowUpRight aria-hidden="true" /> : <ArrowDownLeft aria-hidden="true" />}
                {value === 'expense' ? 'Expense' : 'Income'}
              </Button>
            ))}
          </div>

          {favorites.length > 0 && type === 'expense' && (
            <section aria-label="Favorite transactions" className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Favorites</h3>
              <m.div
                animate="visible"
                className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1"
                initial={motionDisabled ? false : 'hidden'}
                variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.03 } } }}
              >
                {favorites.map((favorite) => (
                  <m.button
                    animate="visible"
                    className="glass-flat flex shrink-0 snap-start flex-col items-start rounded-xl border border-border/60 px-3 py-2 text-left transition-colors hover:bg-accent"
                    initial={motionDisabled ? { opacity: 0 } : 'hidden'}
                    key={favorite.key}
                    onClick={() => applyFavorite(favorite)}
                    type="button"
                    variants={{ hidden: { opacity: 0, scale: 0.96 }, visible: { opacity: 1, scale: 1 } }}
                    transition={motionDisabled ? { duration: 0.12 } : { type: 'spring', stiffness: 500, damping: 32 }}
                  >
                    <span className="max-w-32 truncate text-xs font-semibold">{favorite.merchant}</span>
                    <span className="mt-1 text-[11px] text-muted-foreground">{formatINR(favorite.amount)} · {favorite.categoryName}</span>
                  </m.button>
                ))}
              </m.div>
            </section>
          )}

          <section aria-label={`${type} categories`} className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Category</h3>
            {sortedCategories.length ? (
              <div className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1">
                {sortedCategories.map((category) => {
                  const categoryIdValue = idOf(category)
                  const selected = categoryId === categoryIdValue
                  return (
                    <m.button
                      aria-pressed={selected}
                      className={`relative flex min-h-10 shrink-0 snap-start items-center gap-2 overflow-hidden rounded-full border px-3 text-sm font-medium transition-colors ${selected ? 'border-primary text-primary-foreground' : 'glass-flat border-border/70 hover:bg-accent'}`}
                      key={categoryIdValue}
                      onClick={() => {
                        setCategoryId(categoryIdValue)
                        setSaveError('')
                      }}
                      type="button"
                    >
                      {selected && (
                        <m.span
                          className="absolute inset-0 rounded-full bg-primary"
                          layoutId={motionDisabled ? undefined : 'quickadd-category-highlight'}
                          transition={motionDisabled ? { duration: 0.12 } : { type: 'spring', stiffness: 500, damping: 36 }}
                        />
                      )}
                      <span className="relative z-10 flex items-center gap-2">
                        <span aria-hidden="true">{category.icon || '📦'}</span>
                        {category.name}
                      </span>
                    </m.button>
                  )
                })}
              </div>
            ) : (
              <p className="py-2 text-sm text-muted-foreground">No {type} categories are available.</p>
            )}
            <CategoryCreator
              categories={categories}
              disabled={categoriesQuery.isPending && !categoriesQuery.data && !cachedCategories.data}
              onCreated={(category) => {
                setCategoryId(idOf(category))
                setSaveError('')
              }}
              type={type}
            />
          </section>

          <m.div
            animate={amountShakeKey
              ? motionDisabled ? { opacity: [1, 0.6, 1] } : { x: [0, -3, 3, -2, 2, 0] }
              : amountBounceKey
                ? motionDisabled ? { opacity: [0.75, 1] } : { y: [0, -4, 0] }
                : { x: 0 }}
            aria-label={`Amount ${savedAmountLabel}`}
            className="rounded-2xl border border-border/60 bg-background/50 px-4 py-3 text-center"
            key={`amount-shake-${amountShakeKey}`}
            transition={motionDisabled ? { duration: 0.12 } : { duration: 0.18 }}
          >
            <p className="text-xs font-medium text-muted-foreground">Amount</p>
            <div className="relative mt-1 flex min-h-11 items-center justify-center overflow-hidden">
              <AnimatePresence initial={false} mode="popLayout">
                <m.p
                  aria-live="polite"
                  animate={{ opacity: 1, y: 0 }}
                  className="text-4xl font-bold tracking-tight tabular-nums"
                  exit={motionDisabled ? { opacity: 0 } : { opacity: 0, y: -8 }}
                  initial={motionDisabled ? { opacity: 0 } : { opacity: 0, y: 8 }}
                  key={`${amountMotionKey}-${savedAmountLabel}`}
                  transition={motionDisabled ? { duration: 0.1 } : { duration: 0.12, ease: 'easeOut' }}
                >
                  {savedAmountLabel}
                </m.p>
              </AnimatePresence>
            </div>
          </m.div>

          <NumberPad onKey={applyNumberKey} />

          <details
            className="rounded-2xl border border-border/60 bg-background/40 p-3"
            onToggle={(event) => setMoreOpen(event.currentTarget.open)}
            open={moreOpen}
          >
            <summary className="cursor-pointer list-none text-sm font-semibold">
              More <span className="ml-1 text-xs font-normal text-muted-foreground">Wallet, date, payment, details</span>
            </summary>
            <div className="mt-3 grid gap-3">
              <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
                Wallet
                <select className="h-10 rounded-xl border border-input bg-background px-3 text-sm text-foreground" onChange={(event) => chooseWallet(event.target.value)} value={walletId}>
                  <option value="">Choose a wallet</option>
                  {wallets.map((wallet) => <option key={idOf(wallet)} value={idOf(wallet)}>{wallet.name}{wallet.isDefault ? ' (Default)' : ''}</option>)}
                </select>
              </label>
              <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
                Date and time
                <input className="h-10 rounded-xl border border-input bg-background px-3 text-sm text-foreground" max={maxDate} onChange={(event) => setTxnDate(event.target.value)} type="datetime-local" value={txnDate} />
              </label>
              <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
                Payment method
                <select className="h-10 rounded-xl border border-input bg-background px-3 text-sm text-foreground" onChange={(event) => setPaymentMethod(event.target.value)} value={paymentMethod}>
                  {paymentMethods.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
                Merchant (optional)
                <input className="h-10 rounded-xl border border-input bg-background px-3 text-sm text-foreground" maxLength={80} onChange={(event) => setMerchant(event.target.value)} value={merchant} />
              </label>
              <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
                Note (optional)
                <textarea className="min-h-16 rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground" maxLength={300} onChange={(event) => setNote(event.target.value)} value={note} />
              </label>
            </div>
          </details>
        </div>
        {saveError && <p aria-live="assertive" className="mt-2 text-sm text-destructive">{saveError}</p>}
        {!walletId && <p className="mt-2 text-sm text-muted-foreground">Add a wallet before saving a transaction.</p>}
        <div className="grid shrink-0 grid-cols-[1fr_auto] gap-2 border-t border-border/60 pt-3">
          <Button
            className="h-12 rounded-xl text-base"
            disabled={!validAmount || !categoryId || !walletId || savePhase !== 'idle'}
            onClick={() => save(false)}
            type="button"
          >
            <AnimatePresence initial={false} mode="wait">
              {savePhase === 'saving' ? (
                <m.span
                  animate={{ opacity: 1 }}
                  className="inline-flex items-center gap-2"
                  exit={{ opacity: 0 }}
                  initial={{ opacity: 0 }}
                  key="saving"
                  transition={{ duration: motionDisabled ? 0.12 : 0.08 }}
                >
                  <LoaderCircle aria-hidden="true" className={`size-4 ${motionDisabled ? '' : 'animate-spin'}`} />
                  Saving
                </m.span>
              ) : savePhase === 'saved' ? (
                <m.span
                  animate={{ opacity: 1 }}
                  className="inline-flex items-center gap-2"
                  exit={{ opacity: 0 }}
                  initial={{ opacity: 0 }}
                  key="saved"
                  transition={{ duration: motionDisabled ? 0.12 : 0.08 }}
                >
                  <Check aria-hidden="true" className="size-4" />
                  Saved
                </m.span>
              ) : (
                <m.span
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  initial={{ opacity: 0 }}
                  key="save"
                  transition={{ duration: motionDisabled ? 0.12 : 0.08 }}
                >
                  Save
                </m.span>
              )}
            </AnimatePresence>
          </Button>
          <Button
            aria-label="Save and add another"
            className="h-12 rounded-xl px-3"
            disabled={!validAmount || !categoryId || !walletId || savePhase !== 'idle'}
            onClick={() => save(true)}
            title="Save and add another"
            type="button"
            variant="outline"
          >
            + Add
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

export default QuickAddSheet
