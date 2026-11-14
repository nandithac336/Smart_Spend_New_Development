import { useEffect, useState } from 'react'
import { Filter, Search, X } from 'lucide-react'
import { AnimatePresence, m } from 'motion/react'
import { useMotionDisabled } from '@/hooks/useMotionDisabled.js'
import { activeTransactionFilterCount, filterChips, removeFilter } from './transactionFilterUtils.js'
import TransactionFilterFields from './TransactionFilterFields.jsx'
import { Button } from '@/components/ui/button.jsx'
import { Input } from '@/components/ui/input.jsx'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet.jsx'

const EMPTY_FILTERS = ['q', 'type', 'walletId', 'categoryId', 'datePreset', 'from', 'to', 'minAmount', 'maxAmount', 'tag']

export function TransactionFilters({ params, setParams, timeZone }) {
  const currentSearch = params.get('q') ?? ''
  const [searchDraft, setSearchDraft] = useState({ source: currentSearch, value: currentSearch })
  const search = searchDraft.source === currentSearch ? searchDraft.value : currentSearch
  const [sheetOpen, setSheetOpen] = useState(false)
  const [showMobileFilters, setShowMobileFilters] = useState(false)
  const motionDisabled = useMotionDisabled()

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setParams((current) => {
        const next = new URLSearchParams(current)
        if (search.trim()) next.set('q', search.trim())
        else next.delete('q')
        return next
      }, { replace: true })
    }, 400)
    return () => window.clearTimeout(timeout)
  }, [search, setParams])

  const activeCount = activeTransactionFilterCount(params)

  function clearAll() {
    setSearchDraft({ source: currentSearch, value: '' })
    setParams((current) => {
      const next = new URLSearchParams(current)
      EMPTY_FILTERS.forEach((key) => next.delete(key))
      next.delete('fromDate')
      next.delete('toDate')
      return next
    }, { replace: true })
  }

  function updateSearch(value) {
    setSearchDraft({ source: currentSearch, value })
  }

  const filterFields = <TransactionFilterFields params={params} setParams={setParams} timeZone={timeZone} />

  return (
    <section aria-label="Transaction filters" className="glass-strong rounded-2xl p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="group relative min-w-0 flex-1 transition-[width] duration-200 ease-out sm:w-64 sm:flex-none focus-within:sm:w-80">
          <Search aria-hidden="true" className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Search transactions" className="h-10 pl-9" maxLength={80} onChange={(event) => updateSearch(event.target.value)} placeholder="Search merchant or note" type="search" value={search} />
        </label>
        <div className="flex items-center justify-between gap-2 sm:justify-start">
          <span className="text-sm text-muted-foreground">{activeCount} active</span>
          {activeCount > 0 && <Button onClick={clearAll} size="sm" variant="ghost"><X aria-hidden="true" />Clear all</Button>}
          <div className="sm:hidden">
            <Sheet
              onOpenChange={(open) => {
                setSheetOpen(open)
                if (open) setShowMobileFilters(true)
              }}
              open={sheetOpen}
            >
              <SheetTrigger asChild><Button aria-label="Open filters" variant="outline"><Filter aria-hidden="true" />Filters</Button></SheetTrigger>
              <SheetContent className="max-h-[85dvh] overflow-y-auto rounded-t-3xl p-5" side="bottom">
                <SheetHeader className="px-0 pt-1"><SheetTitle>Filters</SheetTitle></SheetHeader>
                {showMobileFilters && filterFields}
                <Button className="mt-2 w-full" onClick={() => setSheetOpen(false)}>Done</Button>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
      <div className="mt-4 hidden sm:block">{filterFields}</div>
      <AnimatePresence initial={false}>
        {activeCount > 0 && (
          <m.div className="mt-3 flex flex-wrap gap-2" layout>
            {filterChips(params).map((chip) => (
              <m.button
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-accent/70 px-3 py-1.5 text-xs font-medium text-accent-foreground"
                exit={{ opacity: 0, scale: 0.8, y: -4 }}
                initial={{ opacity: 0, scale: 0.8, y: 4 }}
                key={chip.key}
                layout
                onClick={() => removeFilter(chip.key, setParams)}
                transition={motionDisabled ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 30 }}
                type="button"
              >
                {chip.label}
                <X aria-hidden="true" className="size-3" />
              </m.button>
            ))}
          </m.div>
        )}
      </AnimatePresence>
    </section>
  )
}
