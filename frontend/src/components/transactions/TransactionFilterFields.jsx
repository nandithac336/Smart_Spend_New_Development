import { useMotionDisabled } from '@/hooks/useMotionDisabled.js'
import { useCategories } from '@/hooks/useCategories.js'
import { useWallets } from '@/hooks/useWallets.js'
import { dateOnlyRangeToIso, datePresetRange } from '@/lib/transactionDates.js'
import { Input } from '@/components/ui/input.jsx'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.jsx'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx'
import { m } from 'motion/react'

const TYPE_OPTIONS = [
  ['all', 'All types'],
  ['expense', 'Expense'],
  ['income', 'Income'],
  ['transfer', 'Transfer'],
]

const DATE_OPTIONS = [
  ['none', 'Any date'],
  ['today', 'Today'],
  ['week', 'This week'],
  ['month', 'This month'],
  ['year', 'This year'],
  ['custom', 'Custom'],
]

function TransactionFilterFields({ params, setParams, timeZone }) {
  const type = params.get('type') ?? 'all'
  const datePreset = params.get('datePreset') ?? 'none'
  const { data: walletData } = useWallets()
  const wallets = walletData?.wallets ?? walletData ?? []
  const categoryType = type === 'expense' || type === 'income' ? type : undefined
  const { data: categories = [] } = useCategories(categoryType)
  const motionDisabled = useMotionDisabled()

  function update(key, value) {
    setParams((current) => {
      const next = new URLSearchParams(current)
      const previousValue = next.get(key)
      if (!value || value === 'all' || value === 'none') next.delete(key)
      else next.set(key, value)

      if (key === 'type' && value !== previousValue) next.delete('categoryId')
      if (key === 'datePreset') {
        if (value !== 'custom') {
          next.delete('fromDate')
          next.delete('toDate')
          next.delete('from')
          next.delete('to')
        } else {
          next.delete('from')
          next.delete('to')
          const range = dateOnlyRangeToIso(next.get('fromDate') ?? '', next.get('toDate') ?? '', timeZone)
          if (range.from) next.set('from', range.from)
          if (range.to) next.set('to', range.to)
        }
        if (value && value !== 'none' && value !== 'custom') {
          const range = datePresetRange(value, timeZone)
          next.set('from', range.from)
          next.set('to', range.to)
        }
      }
      return next
    }, { replace: true })
  }

  function updateCustomDate(key, value) {
    setParams((current) => {
      const next = new URLSearchParams(current)
      next.set('datePreset', 'custom')
      const values = {
        from: key === 'from' ? value : next.get('fromDate') ?? '',
        to: key === 'to' ? value : next.get('toDate') ?? '',
      }
      if (key === 'from') {
        if (value) next.set('fromDate', value)
        else next.delete('fromDate')
      } else if (value) next.set('toDate', value)
      else next.delete('toDate')
      const range = dateOnlyRangeToIso(values.from, values.to, timeZone)
      if (range.from) next.set('from', range.from)
      else next.delete('from')
      if (range.to) next.set('to', range.to)
      else next.delete('to')
      return next
    }, { replace: true })
  }

  function updateAmount(key, value) {
    if (value && !/^\d+(?:\.\d{0,2})?$/.test(value)) return
    update(key, value)
  }

  return (
    <>
      <Tabs className="mb-3" onValueChange={(value) => update('type', value)} value={type}>
        <TabsList aria-label="Filter by transaction type" className="w-full sm:w-fit">
          {TYPE_OPTIONS.map(([value, label]) => (
            <TabsTrigger className="isolate" key={value} value={value}>
              {type === value && <m.span className="absolute inset-0 z-0 rounded-md bg-background shadow-sm" layoutId="transaction-type-indicator" transition={motionDisabled ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34 }} />}
              <span className="relative z-10">{label === 'All types' ? 'All' : label}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="space-y-1.5 text-xs font-medium">
          Wallet
          <Select onValueChange={(value) => update('walletId', value)} value={params.get('walletId') ?? 'all'}>
            <SelectTrigger className="h-10 w-full"><SelectValue placeholder="All wallets" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All wallets</SelectItem>
              {wallets.map((wallet) => <SelectItem key={wallet.id ?? wallet._id} value={wallet.id ?? wallet._id}>{wallet.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </label>
        <label className="space-y-1.5 text-xs font-medium">
          Category
          <Select disabled={type === 'transfer'} onValueChange={(value) => update('categoryId', value)} value={params.get('categoryId') ?? 'all'}>
            <SelectTrigger className="h-10 w-full"><SelectValue placeholder="All categories" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((category) => <SelectItem key={category.id ?? category._id} value={category.id ?? category._id}>{category.icon} {category.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </label>
        <label className="space-y-1.5 text-xs font-medium">
          Date
          <Select onValueChange={(value) => update('datePreset', value)} value={datePreset}>
            <SelectTrigger className="h-10 w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{DATE_OPTIONS.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
          </Select>
        </label>
        {datePreset === 'custom' && (
          <>
            <label className="space-y-1.5 text-xs font-medium">
              From
              <Input aria-label="From date" className="h-10" onChange={(event) => updateCustomDate('from', event.target.value)} type="date" value={params.get('fromDate') ?? ''} />
            </label>
            <label className="space-y-1.5 text-xs font-medium">
              To
              <Input aria-label="To date" className="h-10" onChange={(event) => updateCustomDate('to', event.target.value)} type="date" value={params.get('toDate') ?? ''} />
            </label>
          </>
        )}
        <label className="space-y-1.5 text-xs font-medium">
          Minimum amount (₹)
          <Input aria-label="Minimum amount in rupees" className="h-10" inputMode="decimal" onChange={(event) => updateAmount('minAmount', event.target.value)} placeholder="0.00" value={params.get('minAmount') ?? ''} />
        </label>
        <label className="space-y-1.5 text-xs font-medium">
          Maximum amount (₹)
          <Input aria-label="Maximum amount in rupees" className="h-10" inputMode="decimal" onChange={(event) => updateAmount('maxAmount', event.target.value)} placeholder="0.00" value={params.get('maxAmount') ?? ''} />
        </label>
        <label className="space-y-1.5 text-xs font-medium">
          Tag
          <Input aria-label="Filter by tag" className="h-10" maxLength={30} onChange={(event) => update('tag', event.target.value)} placeholder="e.g. groceries" value={params.get('tag') ?? ''} />
        </label>
      </div>
    </>
  )
}

export default TransactionFilterFields
