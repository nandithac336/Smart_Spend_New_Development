import { useState } from 'react'
import { CircleAlert, Copy, Save, SkipForward } from 'lucide-react'
import { Button } from '@/components/ui/button.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Label } from '@/components/ui/label.jsx'
import { formatTxnDate } from '@/lib/dates.js'
import { getErrorMessage } from '@/lib/errors.js'
import { formatINR } from '@/lib/money.js'
import { statementDraftPayload, statementDraftValues, validateStatementDraft } from '@/lib/statementImport.js'

function StatementDraftRow({ draft, categories, timeZone, selected, onSelect, onSave, onSkip, busy, editable }) {
  const [values, setValues] = useState(() => statementDraftValues(draft, timeZone))
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const [allowDuplicate, setAllowDuplicate] = useState(false)
  const [dirty, setDirty] = useState(false)
  const imported = draft.reviewStatus === 'imported'
  const skipped = draft.reviewStatus === 'skipped'
  const duplicate = draft.duplicateStatus === 'possible'
  const valid = !Object.keys(validateStatementDraft(values, timeZone).errors).length
  const canSelect = editable && !dirty && valid && !imported && !skipped && (!duplicate || allowDuplicate)
  const type = values.direction === 'debit' ? 'expense' : values.direction === 'credit' ? 'income' : ''
  const categoryOptions = categories.filter((category) => category.type === type)
  const suggestion = categories.find((item) => String(item.id ?? item._id) === String(draft.suggestedCategoryId))

  function update(key, value) {
    setDirty(true)
    if (selected) onSelect(draft, false, false)
    setValues((current) => ({ ...current, [key]: value, ...(key === 'direction' ? { categoryId: '' } : {}) }))
    setErrors((current) => ({ ...current, [key]: '' }))
    setError('')
  }

  async function save(extra = {}) {
    const result = statementDraftPayload(values, timeZone)
    setErrors(result.errors ?? {})
    if (result.errors) return
    try {
      const saved = await onSave(draft, { ...result.changes, ...extra })
      setValues(statementDraftValues(saved, timeZone))
      setDirty(false)
      setAllowDuplicate(false)
    } catch (saveError) {
      setError(getErrorMessage(saveError, 'Could not save this statement row.'))
    }
  }

  const amount = draft.amountPaise == null ? '—' : formatINR(draft.amountPaise)
  return (
    <article className={`glass-flat space-y-4 rounded-2xl p-4 ${duplicate ? 'border border-amber-400/30' : ''}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Statement row {draft.rowNumber}</p>
          <p className="mt-1 break-words text-sm font-semibold">{draft.description || 'Description not detected'}</p>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>{draft.txnDate ? formatTxnDate(draft.txnDate, { timeZone }) : 'Date not detected'}</span>
            <span>Debit: {draft.direction === 'debit' ? amount : '—'}</span>
            <span>Credit: {draft.direction === 'credit' ? amount : '—'}</span>
            <span>Type: {type ? (type === 'expense' ? 'Expense' : 'Income') : 'Not detected'}</span>
            {draft.balancePaise != null && <span>Balance: {formatINR(draft.balancePaise)}</span>}
          </div>
        </div>
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary">{imported ? 'Imported' : skipped ? 'Skipped' : type ? type : 'Needs review'}</span>
      </div>
      {duplicate && (
        <div className="space-y-2 rounded-xl border border-amber-400/25 bg-amber-400/5 p-3" role="note">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-200"><Copy aria-hidden="true" className="size-4" />Possible duplicate — review carefully</p>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {draft.duplicateMatches.map((match) => <li key={String(match.transactionId)}>Transaction {String(match.transactionId)} · {match.matchType.replaceAll('_', ' ')}</li>)}
          </ul>
          {!imported && !skipped && (
            <label className="flex cursor-pointer items-start gap-2 text-xs text-amber-100">
              <input checked={allowDuplicate} disabled={busy} onChange={(event) => {
                setAllowDuplicate(event.target.checked)
                if (!event.target.checked && selected) onSelect(draft, false, false)
              }} type="checkbox" />
              I reviewed the duplicate candidate and explicitly allow this row.
            </label>
          )}
        </div>
      )}
      {!imported && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <div className="space-y-1.5"><Label htmlFor={`imp-date-${draft._id}`}>Date and time</Label><Input aria-invalid={Boolean(errors.txnDate)} disabled={!editable || busy} id={`imp-date-${draft._id}`} onChange={(event) => update('txnDate', event.target.value)} type="datetime-local" value={values.txnDate} />{errors.txnDate && <p className="text-xs text-destructive">{errors.txnDate}</p>}</div>
          <div className="space-y-1.5"><Label htmlFor={`imp-desc-${draft._id}`}>Description / merchant</Label><Input disabled={!editable || busy} id={`imp-desc-${draft._id}`} maxLength={300} onChange={(event) => update('description', event.target.value)} value={values.description} /></div>
          <div className="space-y-1.5"><Label htmlFor={`imp-amount-${draft._id}`}>Amount (₹)</Label><Input aria-invalid={Boolean(errors.amount)} disabled={!editable || busy} id={`imp-amount-${draft._id}`} inputMode="decimal" onChange={(event) => update('amount', event.target.value)} value={values.amount} />{errors.amount && <p className="text-xs text-destructive">{errors.amount}</p>}</div>
          <div className="space-y-1.5"><Label htmlFor={`imp-direction-${draft._id}`}>Transaction type</Label><select className="h-10 w-full rounded-xl border border-input bg-background/45 px-3 text-sm disabled:opacity-50" disabled={!editable || busy} id={`imp-direction-${draft._id}`} onChange={(event) => update('direction', event.target.value)} value={values.direction}><option value="">Choose type</option><option value="debit">Debit · Expense</option><option value="credit">Credit · Income</option></select>{errors.direction && <p className="text-xs text-destructive">{errors.direction}</p>}</div>
          <div className="space-y-1.5"><Label htmlFor={`imp-category-${draft._id}`}>Category (optional)</Label><select className="h-10 w-full rounded-xl border border-input bg-background/45 px-3 text-sm disabled:opacity-50" disabled={!editable || busy || !type} id={`imp-category-${draft._id}`} onChange={(event) => update('categoryId', event.target.value)} value={values.categoryId}><option value="">No category</option>{categoryOptions.map((item) => <option key={item.id ?? item._id} value={item.id ?? item._id}>{item.icon ? `${item.icon} ` : ''}{item.name}</option>)}</select>{suggestion && <p className="text-xs text-muted-foreground">Suggested: {suggestion.name} (not auto-assigned)</p>}{!suggestion && draft.suggestedCategoryId && <p className="text-xs text-muted-foreground">Suggested category ID: {String(draft.suggestedCategoryId)}</p>}</div>
        </div>
      )}
      {draft.validationErrors?.length > 0 && !imported && <p className="flex gap-2 text-xs text-amber-200"><CircleAlert aria-hidden="true" className="size-4 shrink-0" />Parser notes: {draft.validationErrors.join('; ')}. Verify corrected values before importing.</p>}
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      {dirty && <p className="text-xs text-amber-200">Save your edits before selecting this row.</p>}
      {!imported && (
        <div className="flex flex-col gap-3 border-t border-border/70 pt-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex cursor-pointer items-center gap-2 text-sm"><input checked={selected} disabled={busy || (!canSelect && !selected)} onChange={(event) => onSelect(draft, event.target.checked, allowDuplicate)} type="checkbox" />Select for import</label>
          {editable && <div className="flex gap-2"><Button disabled={busy || skipped} onClick={() => save()} size="sm" type="button" variant="outline"><Save aria-hidden="true" />Save edits</Button>{skipped ? <Button disabled={busy || dirty} onClick={() => save({ reviewStatus: 'pending' })} size="sm" type="button" variant="ghost">Restore row</Button> : <Button disabled={busy || dirty} onClick={() => onSkip(draft)} size="sm" type="button" variant="ghost"><SkipForward aria-hidden="true" />Skip row</Button>}</div>}
        </div>
      )}
    </article>
  )
}

export default StatementDraftRow
