import { Button } from '@/components/ui/button.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Label } from '@/components/ui/label.jsx'
import { Link } from 'react-router-dom'

const paymentMethods = [
  ['cash', 'Cash'],
  ['upi', 'UPI'],
  ['debit_card', 'Debit card'],
  ['credit_card', 'Credit card'],
  ['net_banking', 'Net banking'],
]

export function FieldError({ children }) {
  return children ? <p className="text-xs text-destructive">{children}</p> : null
}

export function SelectField({ id, label, value, options, onChange, error, disabled = false, placeholder, onRetry }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <select
        aria-invalid={Boolean(error)}
        className="h-10 w-full rounded-xl border border-input bg-background/45 px-3 text-sm text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 aria-invalid:border-destructive"
        disabled={disabled}
        id={id}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        <option value="">{placeholder ?? 'Choose one'}</option>
        {options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}
      </select>
      <FieldError>{error}</FieldError>
      {error && onRetry && (
        <Button onClick={onRetry} size="sm" type="button" variant="outline">Retry</Button>
      )}
    </div>
  )
}

function ScanTransactionFields({
  values,
  errors,
  onChange,
  wallets,
  walletsLoading,
  walletsError,
  retryWallets,
  categories,
  categoriesLoading,
  categoriesError,
  retryCategories,
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="scan-merchant">Merchant or recipient (optional)</Label>
        <Input autoComplete="off" id="scan-merchant" maxLength={80} onChange={(event) => onChange('merchant', event.target.value)} value={values.merchant} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="scan-amount">Amount (₹)</Label>
        <Input aria-invalid={Boolean(errors.amount)} id="scan-amount" inputMode="decimal" max="100000000" onChange={(event) => onChange('amount', event.target.value)} placeholder="Enter amount" value={values.amount} />
        <FieldError>{errors.amount}</FieldError>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="scan-date">Transaction date and time</Label>
        <Input aria-invalid={Boolean(errors.transactionDate)} id="scan-date" max={values.maxDate} onChange={(event) => onChange('transactionDate', event.target.value)} type="datetime-local" value={values.transactionDate} />
        <FieldError>{errors.transactionDate}</FieldError>
      </div>
      <SelectField
        error={errors.type}
        id="scan-type"
        label="Transaction type"
        onChange={(value) => onChange('type', value)}
        options={[['expense', 'Expense'], ['income', 'Income']]}
        value={values.type}
      />
      <SelectField
        disabled={walletsLoading || walletsError || wallets.length === 0}
        error={walletsError ? 'Could not load wallets.' : errors.walletId}
        id="scan-wallet"
        label="Wallet"
        onChange={(value) => onChange('walletId', value)}
        options={wallets.map((wallet) => [wallet.id ?? wallet._id, wallet.name])}
        placeholder={walletsLoading ? 'Loading wallets…' : 'Choose wallet'}
        onRetry={retryWallets}
        value={values.walletId}
      />
      {!walletsLoading && !walletsError && wallets.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Create a wallet before confirming a transaction. <Link className="text-primary underline-offset-4 hover:underline" to="/wallets">Manage wallets</Link>
        </p>
      )}
      <SelectField
        disabled={categoriesLoading || categoriesError}
        error={categoriesError ? 'Could not load categories.' : errors.categoryId}
        id="scan-category"
        label="Category (optional)"
        onChange={(value) => onChange('categoryId', value)}
        options={categories.map((category) => [category.id ?? category._id, `${category.icon ?? ''} ${category.name}`.trim()])}
        placeholder={categoriesLoading ? 'Loading categories…' : 'No category'}
        onRetry={retryCategories}
        value={values.categoryId}
      />
      <SelectField
        error={errors.paymentMethod}
        id="scan-payment-method"
        label="Payment method"
        onChange={(value) => onChange('paymentMethod', value)}
        options={paymentMethods}
        value={values.paymentMethod}
      />
      <div className="space-y-1.5">
        <Label htmlFor="scan-note">Note (optional)</Label>
        <Input id="scan-note" maxLength={300} onChange={(event) => onChange('note', event.target.value)} value={values.note} />
      </div>
    </div>
  )
}

export default ScanTransactionFields
