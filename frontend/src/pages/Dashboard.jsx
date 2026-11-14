import { useEffect, useRef, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, RefreshCw, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button.jsx'
import { Input } from '@/components/ui/input.jsx'
import ErrorState from '@/components/common/ErrorState.jsx'
import { useAuth } from '@/hooks/useAuth.js'
import { useDashboard } from '@/hooks/useDashboard.js'
import { useMotionDisabled } from '@/hooks/useMotionDisabled.js'
import DashboardLoading from '@/components/dashboard/DashboardLoading.jsx'
import { DashboardSummary, DashboardWallets } from '@/components/dashboard/DashboardSummary.jsx'
import DashboardSpending from '@/components/dashboard/DashboardSpending.jsx'
import '@/components/dashboard/Dashboard.css'

function calendarDateInZone(timeZone) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date()).filter((part) => part.type !== 'literal').map(({ type, value }) => [type, value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}

function formatSelectedDate(value, options) {
  const selected = new Date(`${value}T00:00:00.000Z`)
  return new Intl.DateTimeFormat('en-IN', {
    ...options,
    timeZone: 'UTC',
  }).format(selected)
}

function shiftMonth(value, monthDelta, latestDate) {
  const [year, month, day] = value.split('-').map(Number)
  const targetMonth = new Date(Date.UTC(year, month - 1 + monthDelta, 1))
  const targetYear = targetMonth.getUTCFullYear()
  const targetMonthIndex = targetMonth.getUTCMonth()
  const finalDay = new Date(Date.UTC(targetYear, targetMonthIndex + 1, 0)).getUTCDate()
  const shifted = `${targetYear}-${String(targetMonthIndex + 1).padStart(2, '0')}-${String(Math.min(day, finalDay)).padStart(2, '0')}`
  return shifted > latestDate ? latestDate : shifted
}

const DASHBOARD_ENTRANCE_KEY = 'smart-spend-dashboard-entrance-seen'

function Dashboard() {
  const { user } = useAuth()
  const userTimeZone = user?.timezone || 'Asia/Kolkata'
  const [selectedDate, setSelectedDate] = useState(() => calendarDateInZone(userTimeZone))
  const { data, isPending, isFetching, isError, refetch } = useDashboard(selectedDate)
  const motionDisabled = useMotionDisabled()
  const [animateEntrance] = useState(() => {
    try {
      return window.sessionStorage.getItem(DASHBOARD_ENTRANCE_KEY) !== 'true'
    } catch {
      // Session storage can be blocked in private mode; skip the entrance animation.
      return false
    }
  })
  const [highlightedTransactionIds, setHighlightedTransactionIds] = useState(() => new Set())
  const previousTransactionIds = useRef(null)
  const timeZone = data?.period?.timezone || userTimeZone
  const todayDate = calendarDateInZone(timeZone)
  const periodLabel = formatSelectedDate(`${selectedDate.slice(0, 7)}-01`, {
    month: 'long',
    year: 'numeric',
  })
  const selectedDayLabel = formatSelectedDate(selectedDate, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const firstName = user?.name?.trim().split(/\s+/)[0] || 'there'
  const showEntrance = animateEntrance && !motionDisabled

  useEffect(() => {
    if (isPending || !data || !animateEntrance) return
    try {
      window.sessionStorage.setItem(DASHBOARD_ENTRANCE_KEY, 'true')
    } catch {
      // Session storage can be blocked in private mode; skip replay persistence.
    }
  }, [animateEntrance, data, isPending])

  useEffect(() => {
    if (!data || isPending) return
    const ids = (data.recent ?? [])
      .map((transaction) => transaction.id ?? transaction._id)
      .filter(Boolean)

    if (previousTransactionIds.current === null) {
      previousTransactionIds.current = new Set(ids)
      return
    }

    const previousIds = previousTransactionIds.current
    previousTransactionIds.current = new Set(ids)
    const newIds = ids.filter((id) => !previousIds.has(id))
    if (newIds.length > 0) {
      setHighlightedTransactionIds((current) => new Set([...current, ...newIds]))
    }
  }, [data, isPending])

  if (isPending) return <DashboardLoading />

  if (isError || !data) {
    return (
      <div className="dashboard-page">
        <ErrorState
          description="Your dashboard couldn’t be loaded. Check your connection and try again."
          onRetry={() => refetch()}
          title="Couldn’t load dashboard"
        />
      </div>
    )
  }

  const greeting = `Good day, ${firstName}`

  return (
    <div className={`dashboard-page space-y-5 sm:space-y-6 ${showEntrance ? 'dashboard-entrance' : ''}`}>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            <Sparkles aria-hidden="true" className="size-4" />
            Your money, in focus
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl" aria-label={greeting}>
            {greeting}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{selectedDayLabel}</p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
          <div aria-label="Dashboard date navigation" className="dashboard-period-pill flex items-center gap-1 rounded-full p-1.5">
            <Button
              aria-label="Previous month"
              onClick={() => setSelectedDate((current) => shiftMonth(current, -1, todayDate))}
              size="icon"
              type="button"
              variant="ghost"
            >
              <ChevronLeft aria-hidden="true" className="size-4" />
            </Button>
            <span aria-live="polite" className="min-w-32 text-center text-xs font-semibold">{periodLabel}</span>
            <Button
              aria-label="Next month"
              disabled={selectedDate >= todayDate}
              onClick={() => setSelectedDate((current) => shiftMonth(current, 1, todayDate))}
              size="icon"
              type="button"
              variant="ghost"
            >
              <ChevronRight aria-hidden="true" className="size-4" />
            </Button>
            <label className="relative flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg hover:bg-muted">
              <span className="sr-only">Select dashboard date</span>
              <CalendarDays aria-hidden="true" className="size-4 text-primary" />
              <Input
                aria-label="Select dashboard date"
                className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-primary"
                id="dashboard-date"
                max={todayDate}
                onChange={(event) => {
                  if (event.target.value) setSelectedDate(event.target.value)
                }}
                type="date"
                value={selectedDate}
              />
            </label>
          </div>
          <Button
            aria-label="Refresh dashboard"
            className="dashboard-refresh"
            disabled={isFetching}
            onClick={() => refetch()}
            size="icon"
            variant="outline"
          >
            <RefreshCw aria-hidden="true" className={isFetching && !motionDisabled ? 'animate-spin' : ''} />
          </Button>
        </div>
      </header>

      <DashboardSummary
        data={data}
        animated={showEntrance}
        periodLabel={periodLabel}
        selectedDate={selectedDate}
        todayDate={todayDate}
      />
      <DashboardWallets
        animated={showEntrance}
        motionDisabled={motionDisabled}
        wallets={data.wallets ?? []}
      />
      <DashboardSpending
        categories={data.topCategories ?? []}
        expenses={data.monthSpent ?? 0}
        monthExpenses={data.monthExpenses ?? []}
        highlightedTransactionIds={highlightedTransactionIds}
        recent={data.recent ?? []}
        timeZone={timeZone}
        periodLabel={periodLabel}
        animated={showEntrance}
        motionDisabled={motionDisabled}
      />
    </div>
  )
}

export default Dashboard
