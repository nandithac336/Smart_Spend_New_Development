import { Input } from '@/components/ui/input.jsx'
import { Label } from '@/components/ui/label.jsx'
import { formatINR } from '@/lib/money.js'
import { FieldError, SelectField } from './ScanTransactionFields.jsx'

function ScanTypeFields({ scan, values, errors, onChange }) {
  if (scan.type === 'receipt') {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="scan-tax">Tax (optional)</Label>
          <Input aria-invalid={Boolean(errors.tax)} id="scan-tax" inputMode="decimal" onChange={(event) => onChange('tax', event.target.value)} value={values.tax} />
          <FieldError>{errors.tax}</FieldError>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="scan-currency">Detected currency</Label>
          <Input aria-invalid={Boolean(errors.currency)} id="scan-currency" maxLength={3} onChange={(event) => onChange('currency', event.target.value.toUpperCase())} value={values.currency} />
          <FieldError>{errors.currency}</FieldError>
        </div>
        {scan.draftFields?.items?.length > 0 && (
          <div className="space-y-2 sm:col-span-2">
            <p className="text-sm font-medium">Extracted line items</p>
            <ul className="divide-y divide-border/70 rounded-xl border border-border/70 px-3">
              {scan.draftFields.items.slice(0, 10).map((item, index) => (
                <li className="flex justify-between gap-3 py-2 text-sm" key={`${item.name}-${index}`}>
                  <span className="truncate">{item.name || 'Item'}</span>
                  <span className="shrink-0">{formatINR(item.amountPaise ?? 0)}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">Line items are shown as extracted; the transaction amount above is the editable total.</p>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <SelectField
        error={errors.paymentStatus}
        id="scan-payment-status"
        label="Payment status"
        onChange={(value) => onChange('paymentStatus', value)}
        options={['success', 'failed', 'pending', 'unknown'].map((status) => [status, status[0].toUpperCase() + status.slice(1)])}
        value={values.paymentStatus}
      />
      <SelectField
        error={errors.paymentDirection}
        id="scan-payment-direction"
        label="Payment direction"
        onChange={(value) => onChange('paymentDirection', value)}
        options={ [['out', 'Money sent (expense)'], ['in', 'Money received (income)']] }
        value={values.paymentDirection}
      />
      <div className="space-y-1.5">
        <Label htmlFor="scan-upi-reference">UPI reference (optional)</Label>
        <Input id="scan-upi-reference" maxLength={100} onChange={(event) => onChange('upiRef', event.target.value)} value={values.upiRef} />
      </div>
      <p className="self-end rounded-xl bg-background/35 p-3 text-xs leading-relaxed text-muted-foreground">
        Only a successful payment can be recorded. Manually marking a payment successful does not verify it; compare with the screenshot.
      </p>
    </div>
  )
}

export default ScanTypeFields
