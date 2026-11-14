import { useState } from 'react'
import { ArrowDownToLine, CheckCircle2, LoaderCircle, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import ErrorState from '@/components/common/ErrorState.jsx'
import PageHeader from '@/components/common/PageHeader.jsx'
import StatementDraftList from '@/components/imports/StatementDraftList.jsx'
import StatementImportHistory from '@/components/imports/StatementImportHistory.jsx'
import StatementImportSummary from '@/components/imports/StatementImportSummary.jsx'
import StatementUploadPanel from '@/components/imports/StatementUploadPanel.jsx'
import { Button } from '@/components/ui/button.jsx'
import { useAuth } from '@/hooks/useAuth.js'
import { useCategories } from '@/hooks/useCategories.js'
import { useStatementDraftCount, useStatementDrafts, useStatementImport, useStatementImports } from '@/hooks/useStatementImports.js'
import { useStatementImportMutations } from '@/hooks/useStatementImportMutations.js'
import { useWallets } from '@/hooks/useWallets.js'
import { getErrorMessage } from '@/lib/errors.js'

function StatementImports() {
  const { user } = useAuth()
  const timeZone = user?.timezone || 'Asia/Kolkata'
  const [importId, setImportId] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState(new Set())
  const [allowedDuplicates, setAllowedDuplicates] = useState(new Set())
  const [progress, setProgress] = useState(0)
  const [uploadError, setUploadError] = useState('')
  const [result, setResult] = useState(null)
  const walletsQuery = useWallets()
  const wallets = (walletsQuery.data?.wallets ?? []).filter((wallet) => !wallet.archived)
  const categoriesQuery = useCategories()
  const categories = categoriesQuery.data ?? []
  const importsQuery = useStatementImports()
  const importQuery = useStatementImport(importId)
  const draftsQuery = useStatementDrafts(importId, page)
  const skippedQuery = useStatementDraftCount(importId, 'skipped')
  const mutations = useStatementImportMutations()
  const record = importQuery.data
  const drafts = draftsQuery.data?.drafts ?? []
  const selectedSize = selected.size
  const busy = mutations.update.isPending || mutations.confirm.isPending

  function chooseImport(value) {
    setImportId(String(value._id ?? value.id))
    setPage(1)
    setSelected(new Set())
    setAllowedDuplicates(new Set())
    setResult(null)
    setUploadError('')
  }

  async function upload({ file, walletId, bankName }) {
    setUploadError('')
    setProgress(0)
    setResult(null)
    try {
      const saved = await mutations.upload.mutateAsync({ file, walletId, bankName, onUploadProgress: setProgress })
      chooseImport(saved)
      toast.success('Statement parsed. Review the rows before importing.')
    } catch (error) {
      if (error.importRecord) chooseImport(error.importRecord)
      const message = ['ECONNABORTED', 'ETIMEDOUT'].includes(error?.code)
        ? 'Statement processing took too long. Check your connection and try uploading again.'
        : getErrorMessage(error, 'Could not process this statement. Check the file and try again.')
      setUploadError(message)
    }
  }

  function selectDraft(draft, checked, allowDuplicate) {
    const id = String(draft._id ?? draft.id)
    setSelected((current) => {
      const next = new Set(current)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
    setAllowedDuplicates((current) => {
      const next = new Set(current)
      if (checked && allowDuplicate) next.add(id)
      else next.delete(id)
      return next
    })
  }

  async function saveDraft(draft, changes) {
    const id = String(draft._id ?? draft.id)
    const saved = await mutations.update.mutateAsync({ importId, draftId: id, changes })
    setSelected((current) => new Set([...current].filter((item) => item !== id)))
    setAllowedDuplicates((current) => new Set([...current].filter((item) => item !== id)))
    return saved
  }

  async function skipDraft(draft) {
    try {
      await saveDraft(draft, { reviewStatus: 'skipped' })
      toast.success(`Statement row ${draft.rowNumber} skipped`)
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not skip this row.'))
    }
  }

  async function confirmImport() {
    if (!selectedSize) return
    setResult(null)
    try {
      const response = await mutations.confirm.mutateAsync({
        importId,
        payload: {
          draftIds: [...selected],
          allowDuplicateIds: [...allowedDuplicates].filter((id) => selected.has(id)),
        },
      })
      const count = response.data?.length ?? 0
      setResult({ success: count, failed: 0, skipped: 0, duplicate: response.duplicate })
      setSelected(new Set())
      toast.success(`${count} transaction${count === 1 ? '' : 's'} confirmed from the statement.`)
    } catch (error) {
      const unknown = !error.response
      const message = getErrorMessage(error, 'The selected batch could not be imported.')
      setResult({ success: unknown ? null : 0, failed: unknown ? null : selectedSize, skipped: 0, unknown, message })
      toast.error(message)
    }
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader description="Upload a bank statement, check and correct the parsed rows, then explicitly choose which transactions to add." eyebrow="Import and review" title="Bank Statement Importer" />
      <StatementUploadPanel error={uploadError} busy={mutations.upload.isPending} progress={progress} retryWallets={() => walletsQuery.refetch()} wallets={wallets} walletsError={walletsQuery.isError} walletsLoading={walletsQuery.isLoading} onSubmit={upload} />
      {importQuery.isError && <ErrorState onRetry={() => importQuery.refetch()} title="Couldn’t load this import" />}
      {record && (
        <section aria-label="Statement import status" className="glass-strong space-y-3 rounded-2xl p-4 sm:p-5">
          <StatementImportSummary record={record} retrySkipped={() => skippedQuery.refetch()} skippedCount={skippedQuery.data} skippedCountError={skippedQuery.isError} skippedCountLoading={skippedQuery.isLoading} />
          <StatementDraftList busy={busy} categories={categories} drafts={drafts} editable={!['completed', 'failed'].includes(record.status)} error={draftsQuery.isError} loading={draftsQuery.isLoading} pagination={draftsQuery.data?.pagination} page={page} record={record} retry={() => draftsQuery.refetch()} save={saveDraft} select={selectDraft} selectedIds={selected} setPage={setPage} skip={skipDraft} timeZone={timeZone} />
          {categoriesQuery.isError && <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-400/25 bg-amber-400/5 p-3 text-sm text-amber-100">Categories could not be loaded; continue without categories or retry.<Button onClick={() => categoriesQuery.refetch()} size="sm" type="button" variant="outline">Retry categories</Button></div>}
          {selectedSize > 0 && <div className="flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-muted-foreground">Confirmation creates selected rows as one atomic batch. Review possible duplicates and acknowledgements first.</p><Button disabled={mutations.confirm.isPending} onClick={confirmImport} type="button">{mutations.confirm.isPending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <ArrowDownToLine aria-hidden="true" />}{mutations.confirm.isPending ? 'Importing…' : `Confirm import (${selectedSize})`}</Button></div>}
          {result && <section aria-live="polite" className={`rounded-xl border p-4 ${result.failed ? 'border-destructive/25 bg-destructive/5' : 'border-income/25 bg-income/5'}`} role="status"><h3 className="flex items-center gap-2 text-sm font-semibold">{result.failed ? <TriangleAlert aria-hidden="true" className="size-4 text-destructive" /> : <CheckCircle2 aria-hidden="true" className="size-4 text-income" />}Import result</h3><div className="mt-2 flex flex-wrap gap-4 text-sm"><span>Successful: {result.success ?? 'Unknown'}</span><span>Failed: {result.failed ?? 'Unknown'}</span><span>Skipped in this batch: {result.skipped}</span></div>{result.message && <p className="mt-2 text-xs text-muted-foreground">{result.message} {result.unknown ? 'The response was interrupted; refresh import status before retrying.' : 'The backend processes this request atomically and does not report per-row partial failures.'}</p>}{result.duplicate && <p className="mt-2 text-xs text-muted-foreground">The backend reports these rows were already imported; refresh status to verify.</p>}</section>}
        </section>
      )}
      <StatementImportHistory error={importsQuery.isError} imports={importsQuery.data?.imports ?? []} loading={importsQuery.isLoading} retry={() => importsQuery.refetch()} select={chooseImport} selectedId={importId} timeZone={timeZone} />
    </div>
  )
}

export default StatementImports
