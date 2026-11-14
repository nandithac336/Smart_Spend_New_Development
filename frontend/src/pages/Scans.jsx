import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ScanLine, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import PageHeader from '@/components/common/PageHeader.jsx'
import ScanHistory from '@/components/scans/ScanHistory.jsx'
import ScanReviewForm from '@/components/scans/ScanReviewForm.jsx'
import ScanUploadPanel from '@/components/scans/ScanUploadPanel.jsx'
import { Button } from '@/components/ui/button.jsx'
import { useAuth } from '@/hooks/useAuth.js'
import { useScanMutations } from '@/hooks/useScanMutations.js'
import { useScans } from '@/hooks/useScans.js'
import { getErrorMessage } from '@/lib/errors.js'
import { validateScanFile } from '@/lib/scanForm.js'

function Scans() {
  const { user } = useAuth()
  const timeZone = user?.timezone || 'Asia/Kolkata'
  const [type, setType] = useState('receipt')
  const [file, setFile] = useState(null)
  const [fileError, setFileError] = useState('')
  const [scan, setScan] = useState(null)
  const [isSavedScanSelected, setIsSavedScanSelected] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const mutations = useScanMutations()
  const scansQuery = useScans(type)
  const scans = scansQuery.data?.scans ?? []
  const scanId = scan?._id ?? scan?.id

  function changeType(nextType) {
    setType(nextType)
    setFile(null)
    setFileError('')
    setUploadError('')
    setScan(null)
    setIsSavedScanSelected(false)
  }

  function chooseFile(nextFile, error) {
    setFile(error ? null : nextFile)
    setFileError(error)
    setUploadError('')
    if (!isSavedScanSelected) setScan(null)
  }

  async function uploadImage() {
    const validationError = validateScanFile(file)
    if (validationError) {
      setFileError(validationError)
      return
    }
    setUploadError('')
    try {
      const result = await mutations.upload.mutateAsync({ type, file })
      setScan(result)
      setIsSavedScanSelected(false)
      toast.success(type === 'upi' ? 'UPI screenshot scanned. Review the details.' : 'Receipt scanned. Review the details.')
    } catch (error) {
      if (error.scanDraft) {
        setScan(error.scanDraft)
        setIsSavedScanSelected(false)
        toast.error(error.scanDraft.processingError?.message ?? 'Text extraction failed. Review or edit the saved draft.')
      } else {
        setUploadError(getErrorMessage(error, 'Could not scan this image. Please try again.'))
      }
    }
  }

  async function saveScanDraft(currentScan, changes) {
    const result = await mutations.update.mutateAsync({ id: currentScan._id ?? currentScan.id, changes })
    setScan(result)
    return result
  }

  async function confirmScannedTransaction(currentScan, payload) {
    const result = await mutations.confirm.mutateAsync({
      id: currentScan._id ?? currentScan.id,
      payload,
    })
    setScan({
      ...currentScan,
      extractionStatus: 'confirmed',
      linkedTransactionId: result.data?._id ?? currentScan.linkedTransactionId,
    })
    return result
  }

  async function deleteSavedScan(id) {
    try {
      await mutations.remove.mutateAsync(id)
      if (scanId === id) {
        setScan(null)
        setFile(null)
        setIsSavedScanSelected(false)
      }
      toast.success('Scan draft deleted')
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not delete this scan.'))
    }
  }

  function selectSavedScan(savedScan) {
    setType(savedScan.type)
    setScan(savedScan)
    setIsSavedScanSelected(true)
    setFile(null)
    setFileError('')
    setUploadError('')
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        action={
          <Button asChild variant="outline">
            <Link to="/transactions"><ArrowLeft aria-hidden="true" />Transactions</Link>
          </Button>
        }
        description="Extract a draft from a receipt or UPI screenshot, check the original, edit any OCR mistakes, and choose exactly when to create a transaction."
        eyebrow="Capture and review"
        title="Receipt & UPI Scanner"
      />

      <section className="glass-strong flex items-start gap-3 rounded-2xl p-4 sm:p-5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <ShieldCheck aria-hidden="true" className="size-5" />
        </span>
        <div>
          <h2 className="text-sm font-semibold">Nothing is saved as a transaction until you confirm</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Scanning creates a private, editable draft only. Check each extracted value against the image. UPI screenshots must show a successful payment and a matching sent/received direction. Possible duplicates require a separate explicit override.
          </p>
        </div>
      </section>

      <ScanUploadPanel
        error={fileError || uploadError}
        file={file}
        isUploading={mutations.upload.isPending}
        isSavedScanSelected={isSavedScanSelected}
        onFileChange={chooseFile}
        onTypeChange={changeType}
        onUpload={uploadImage}
        type={type}
      />

      {scan && (
        <ScanReviewForm
          hasImagePreview={Boolean(file)}
          key={scanId}
          onConfirmed={confirmScannedTransaction}
          onScanChange={saveScanDraft}
          scan={scan}
          timeZone={timeZone}
        />
      )}

      <ScanHistory
        deletingId={mutations.remove.isPending ? mutations.remove.variables : ''}
        isError={scansQuery.isError}
        isLoading={scansQuery.isPending}
        onDelete={deleteSavedScan}
        onRetry={() => scansQuery.refetch()}
        onSelect={selectSavedScan}
        scans={scans}
        selectedId={scanId}
      />

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <ScanLine aria-hidden="true" className="size-4" />
        Images must be JPEG, PNG or WebP and no larger than 5 MB. OCR is an estimate; verify the image before creating a transaction.
      </p>
    </div>
  )
}

export default Scans
