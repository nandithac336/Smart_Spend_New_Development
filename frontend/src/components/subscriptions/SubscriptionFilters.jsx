import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input.jsx'

function SubscriptionFilters({ status, frequency, merchant, onStatusChange, onFrequencyChange, onMerchantChange }) {
  return (
    <section aria-label="Filter subscriptions" className="glass-flat grid gap-3 rounded-2xl p-4 sm:grid-cols-[1fr_1fr_1.5fr]">
      <label className="space-y-1.5 text-xs font-medium">
        Review status
        <select
          className="h-10 w-full rounded-xl border border-input bg-background/45 px-3 text-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          onChange={(event) => onStatusChange(event.target.value)}
          value={status}
        >
          <option value="all">All statuses</option>
          <option value="detected">Detected · needs review</option>
          <option value="confirmed">Confirmed</option>
          <option value="dismissed">Dismissed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </label>
      <label className="space-y-1.5 text-xs font-medium">
        Billing frequency
        <select
          className="h-10 w-full rounded-xl border border-input bg-background/45 px-3 text-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          onChange={(event) => onFrequencyChange(event.target.value)}
          value={frequency}
        >
          <option value="all">All frequencies</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="quarterly">Quarterly</option>
          <option value="annual">Annual</option>
        </select>
      </label>
      <label className="space-y-1.5 text-xs font-medium">
        Merchant
        <span className="relative block">
          <Search aria-hidden="true" className="absolute top-3 left-3 size-4 text-muted-foreground" />
          <Input className="pl-9" maxLength={120} onChange={(event) => onMerchantChange(event.target.value)} placeholder="Search merchant" value={merchant} />
        </span>
      </label>
    </section>
  )
}

export default SubscriptionFilters
