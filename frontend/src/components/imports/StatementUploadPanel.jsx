import { useState } from 'react'
import { FileSpreadsheet, LoaderCircle, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Label } from '@/components/ui/label.jsx'
import { validateStatementFile } from '@/services/statementImportApi.js'

function StatementUploadPanel({ wallets, walletsLoading, walletsError, retryWallets, onSubmit, busy, progress, error }) {
  const [file, setFile] = useState(null)
  const [walletId, setWalletId] = useState('')
  const [bankName, setBankName] = useState('')
  const [message, setMessage] = useState('')
  const fileError = file ? validateStatementFile(file) : ''

  function submit(event) {
    event.preventDefault()
    if (fileError || !file) {
      setMessage(fileError || 'Choose a bank statement file.')
    } else if (!walletId) {
      setMessage('Choose the wallet for transactions from this statement.')
    } else {
      setMessage('')
      onSubmit({ file, walletId, bankName })
    }
  }

  return (
    <form className="glass-flat space-y-4 rounded-2xl p-4 sm:p-5" onSubmit={submit}>
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><FileSpreadsheet aria-hidden="true" className="size-5" /></span>
        <div>
          <h2 className="text-sm font-semibold">Upload a statement</h2>
          <p className="mt-1 text-xs text-muted-foreground">CSV, XLSX, or selectable-text PDF · up to 10 MB. Image-only or encrypted PDFs aren’t supported.</p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="statement-file">Statement file</Label>
          <Input accept=".csv,.xlsx,.pdf" aria-invalid={Boolean(fileError)} disabled={busy} id="statement-file" onChange={(event) => {
            setFile(event.target.files?.[0] ?? null)
            event.target.value = ''
            setMessage('')
          }} type="file" />
          {file && <p className="truncate text-xs text-muted-foreground">{file.name}</p>}
          {fileError && <p className="text-xs text-destructive">{fileError}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="statement-wallet">Import into wallet</Label>
          <select className="h-10 w-full rounded-xl border border-input bg-background/45 px-3 text-sm disabled:opacity-50" disabled={busy || walletsLoading || walletsError || !wallets.length} id="statement-wallet" onChange={(event) => {
            setWalletId(event.target.value)
            setMessage('')
          }} value={walletId}>
            <option value="">{walletsLoading ? 'Loading wallets…' : 'Choose wallet'}</option>
            {wallets.map((wallet) => <option key={wallet.id ?? wallet._id} value={wallet.id ?? wallet._id}>{wallet.name}</option>)}
          </select>
          {walletsError && <Button onClick={retryWallets} size="sm" type="button" variant="outline">Retry wallet loading</Button>}
          {!walletsLoading && !walletsError && !wallets.length && <p className="text-xs text-muted-foreground">Create a wallet before importing.</p>}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="statement-bank">Bank name (optional)</Label>
        <Input disabled={busy} id="statement-bank" maxLength={80} onChange={(event) => setBankName(event.target.value)} placeholder="e.g. HDFC Bank" value={bankName} />
      </div>
      {(message || error) && <p className="text-sm text-destructive" role="alert">{message || error}</p>}
      {busy && (
        <div aria-live="polite" className="space-y-2" role="status">
          <div className="flex justify-between text-xs text-muted-foreground"><span>{progress >= 100 ? 'Statement received; parsing rows…' : 'Uploading statement…'}</span><span>{progress}%</span></div>
          <div aria-label="Statement upload progress" aria-valuemax={100} aria-valuemin={0} aria-valuenow={progress} className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar">
            <div className="h-full rounded-full bg-gradient-to-r from-primary to-blue-400 transition-[width]" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">Upload creates review drafts only; transactions are not created until you confirm.</p>
        </div>
      )}
      <Button disabled={busy || walletsLoading || walletsError || !wallets.length || !file || Boolean(fileError)} type="submit">
        {busy ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Upload aria-hidden="true" />}
        {busy ? 'Uploading and parsing…' : 'Upload for review'}
      </Button>
    </form>
  )
}

export default StatementUploadPanel
