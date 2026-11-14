import { useState } from 'react'
import { Check, Clock3, FileImage, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button.jsx'
import ErrorState from '@/components/common/ErrorState.jsx'
import { formatINR } from '@/lib/money.js'

const statusLabels = {
  processing: 'Processing',
  ready: 'Ready to review',
  failed: 'Needs review',
  confirmed: 'Confirmed',
}

function ScanHistory({ scans, isLoading, isError, onRetry, onSelect, onDelete, deletingId, selectedId }) {
  const [deleteTarget, setDeleteTarget] = useState('')
  const list = scans.slice(0, 8)

  return (
    <section aria-label="Recent scans" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Recent scans</h2>
          <p className="mt-1 text-xs text-muted-foreground">Drafts are private to your account and retained for review.</p>
        </div>
        <span className="rounded-full bg-accent/70 px-2.5 py-1 text-xs text-muted-foreground">{scans.length}</span>
      </div>
      {isLoading ? (
        <div aria-busy="true" className="grid gap-2 sm:grid-cols-2">
          {Array.from({ length: 2 }, (_, index) => <div className="glass-flat h-20 animate-pulse rounded-xl" key={index} />)}
        </div>
      ) : isError ? (
        <ErrorState onRetry={onRetry} title="Couldn’t load recent scans" />
      ) : list.length === 0 ? (
        <div className="glass-flat rounded-2xl px-4 py-6 text-center text-sm text-muted-foreground">No previous scans yet.</div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {list.map((scan) => {
            const id = scan._id ?? scan.id
            const fields = scan.draftFields ?? {}
            const confirmed = scan.extractionStatus === 'confirmed'
            const removing = deleteTarget === id && deletingId === id
            return (
              <article className={`flex min-w-0 items-center gap-3 rounded-xl border p-3 ${selectedId === id ? 'border-primary/40 bg-primary/5' : 'border-border/70 bg-background/30'}`} key={id}>
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent/70 text-primary">
                  {confirmed ? <Check aria-hidden="true" className="size-4" /> : <FileImage aria-hidden="true" className="size-4" />}
                </span>
                <button
                  className="min-w-0 flex-1 text-left"
                  disabled={confirmed}
                  onClick={() => onSelect(scan)}
                  type="button"
                >
                  <span className="block truncate text-sm font-medium">{fields.merchant || (scan.type === 'upi' ? 'UPI screenshot' : 'Receipt')}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{fields.amountPaise == null ? 'Amount not detected' : formatINR(fields.amountPaise)}</span>
                    <span aria-hidden="true">·</span>
                    <span>{statusLabels[scan.extractionStatus] ?? scan.extractionStatus}</span>
                    {scan.type === 'upi' && fields.paymentStatus !== 'success' && <span className="text-amber-400">Payment not verified</span>}
                  </span>
                </button>
                {!confirmed && (
                  deleteTarget === id ? (
                    <div className="flex shrink-0 items-center gap-1">
                      <Button disabled={removing} onClick={() => onDelete(id)} size="sm" type="button" variant="destructive">
                        {removing ? 'Deleting…' : 'Delete'}
                      </Button>
                      <Button onClick={() => setDeleteTarget('')} size="sm" type="button" variant="ghost">Cancel</Button>
                    </div>
                  ) : (
                    <>
                      <span className="hidden shrink-0 items-center gap-1 text-[11px] text-muted-foreground sm:inline-flex">
                        <Clock3 aria-hidden="true" className="size-3" />
                        Review
                      </span>
                      <Button aria-label={`Delete ${fields.merchant || scan.type} scan`} onClick={() => setDeleteTarget(id)} size="icon-sm" type="button" variant="ghost">
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </>
                  )
                )}
              </article>
            )
          })}
        </div>
      )}
      {scans.length > list.length && <p className="text-xs text-muted-foreground">Showing the 8 most recent scans.</p>}
    </section>
  )
}

export default ScanHistory
