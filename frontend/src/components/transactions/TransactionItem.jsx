import { ArrowLeftRight } from 'lucide-react'
import { m } from 'motion/react'
import Amount from '@/components/common/Amount.jsx'
import { formatINR } from '@/lib/money.js'
import { formatTxnTime } from '@/lib/dates.js'
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.jsx'
import { Button } from '@/components/ui/button.jsx'

function TransactionItem({
  transaction,
  timeZone = 'Asia/Kolkata',
  className = '',
  style,
  onEdit,
  onDelete,
  minimumFractionDigits = 0,
  layout = false,
  highlighted = false,
  isPhone = false,
  motionDisabled = false,
  syncStatus,
}) {
  const isTransfer = transaction.type === 'transfer'
  const category = transaction.categoryId
  const wallet = transaction.walletId
  const merchant = transaction.merchant?.trim()
  const note = transaction.note?.trim()
  const title = isTransfer
    ? transaction.transferDirection === 'in' ? 'Transfer in' : 'Transfer out'
    : merchant || note || category?.name || 'Uncategorized'
  const subtitle = [
    !isTransfer && category?.name && (merchant || note) ? category.name : null,
    wallet?.name,
    formatTxnTime(transaction.txnDate, timeZone),
  ].filter(Boolean).join(' · ')

  return (
    <m.li
      animate={{ opacity: 1, height: 'auto', marginTop: 0 }}
      className={`relative min-w-0 overflow-hidden rounded-2xl ${layout ? '' : 'list-none'} ${className}`}
      exit={{ opacity: 0, height: 0, marginTop: 0, marginBottom: 0 }}
      initial={layout ? { opacity: 0, height: 0 } : false}
      layout={layout ? 'position' : false}
      style={style}
      transition={motionDisabled ? { duration: 0 } : { layout: { duration: 0.22 }, opacity: { duration: 0.16 }, height: { duration: 0.2 } }}
    >
      {onDelete && isPhone && (
        <span className="absolute inset-y-0 right-0 flex w-20 items-center justify-center bg-destructive text-destructive-foreground">
          <Button aria-label={`Delete ${title}`} className="h-full w-full rounded-none text-destructive-foreground hover:bg-destructive/90 hover:text-destructive-foreground" onClick={onDelete} variant="ghost">
            <Trash2 aria-hidden="true" />
            <span className="sr-only">Delete</span>
          </Button>
        </span>
      )}
      <m.div
        animate={{ x: 0 }}
        className={`glass-flat relative flex min-w-0 items-center gap-3 rounded-2xl p-3 sm:p-4 ${highlighted ? 'transaction-highlight' : ''}`}
        drag={isPhone && onDelete ? 'x' : false}
        dragConstraints={{ left: -80, right: 0 }}
        dragElastic={0.08}
        onDragEnd={(_, info) => {
          if (info.offset.x < -55) onDelete?.()
        }}
        whileDrag={isPhone ? { cursor: 'grabbing' } : undefined}
        style={{ touchAction: 'pan-y' }}
      >
        <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl text-base ${isTransfer ? 'bg-sky-400/10 text-sky-300' : transaction.type === 'income' ? 'bg-emerald-400/10 text-emerald-300' : 'bg-accent text-accent-foreground'}`}>
          {isTransfer
            ? <ArrowLeftRight aria-hidden="true" className="size-5" />
            : <span aria-hidden="true">{category?.icon || '📦'}</span>}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{title}</span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">{subtitle || 'Transaction'}</span>
          {syncStatus && (
            <span className="mt-1 inline-flex rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-[10px] font-semibold text-warning">
              {syncStatus}
            </span>
          )}
        </span>
        <Amount
          aria-label={`${isTransfer ? 'Transfer' : transaction.type} ${formatINR(transaction.amount, { minimumFractionDigits })}`}
          className="text-sm"
          minimumFractionDigits={minimumFractionDigits}
          type={isTransfer ? 'neutral' : transaction.type}
          value={transaction.amount}
        />
        {(onEdit || onDelete) && !syncStatus && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button aria-label={`Actions for ${title}`} size="icon" variant="ghost"><MoreHorizontal aria-hidden="true" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {!isTransfer && onEdit && <DropdownMenuItem onSelect={onEdit}><Pencil aria-hidden="true" />Edit</DropdownMenuItem>}
              {onDelete && <DropdownMenuItem onSelect={onDelete} variant="destructive"><Trash2 aria-hidden="true" />Delete</DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </m.div>
    </m.li>
  )
}

export default TransactionItem
