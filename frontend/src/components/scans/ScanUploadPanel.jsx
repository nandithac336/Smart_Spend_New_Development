import { useEffect, useRef } from 'react'
import { Camera, ImagePlus, LoaderCircle, ScanLine, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button.jsx'
import { validateScanFile, SCAN_IMAGE_TYPES } from '@/lib/scanForm.js'

function ScanUploadPanel({ type, onTypeChange, file, onFileChange, onUpload, isUploading, isSavedScanSelected = false, error }) {
  const previewImageRef = useRef(null)

  useEffect(() => {
    if (!file || !previewImageRef.current) return undefined
    const url = URL.createObjectURL(file)
    previewImageRef.current.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])

  function chooseFile(event) {
    const nextFile = event.target.files?.[0] ?? null
    event.target.value = ''
    onFileChange(nextFile, validateScanFile(nextFile))
  }

  return (
    <section className="glass-flat space-y-4 rounded-2xl p-4 sm:p-5" aria-label="Upload a receipt or UPI screenshot">
      <div>
        <p className="text-sm font-semibold">What are you scanning?</p>
        <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-muted p-1">
          {[
            ['receipt', 'Receipt'],
            ['upi', 'UPI screenshot'],
          ].map(([value, label]) => (
            <Button
              aria-pressed={type === value}
              className={type === value ? 'bg-background shadow-sm' : 'text-muted-foreground'}
              key={value}
              onClick={() => onTypeChange(value)}
              type="button"
              variant="ghost"
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-border bg-background/45 px-4 py-3 text-sm font-medium hover:bg-accent/50">
          <ImagePlus aria-hidden="true" className="size-4 text-primary" />
          Choose image
          <input
            accept={SCAN_IMAGE_TYPES.join(',')}
            aria-label="Choose image"
            className="sr-only"
            onChange={chooseFile}
            type="file"
          />
        </label>
        <label className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-border bg-background/45 px-4 py-3 text-sm font-medium hover:bg-accent/50">
          <Camera aria-hidden="true" className="size-4 text-primary" />
          Take a photo
          <input
            accept={SCAN_IMAGE_TYPES.join(',')}
            aria-label="Take a photo"
            capture="environment"
            className="sr-only"
            onChange={chooseFile}
            type="file"
          />
        </label>
      </div>
      <p className="text-xs text-muted-foreground">JPEG, PNG or WebP · up to 5 MB. UPI screenshots must clearly show a successful payment before you confirm.</p>

      {file && (
        <div className="overflow-hidden rounded-xl border border-border/70 bg-background/40">
          <img alt="Selected image preview" className="mx-auto max-h-80 w-full object-contain" ref={previewImageRef} />
          <p className="truncate border-t border-border/70 px-3 py-2 text-xs text-muted-foreground">{file.name}</p>
        </div>
      )}

      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      <Button
        className="w-full sm:w-auto"
        disabled={!file || Boolean(validateScanFile(file)) || isUploading || isSavedScanSelected}
        onClick={onUpload}
        type="button"
      >
        {isUploading ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <ScanLine aria-hidden="true" />}
        {isUploading ? 'Reading image…' : isSavedScanSelected ? 'Image ready for review' : <><Upload aria-hidden="true" />Scan image</>}
      </Button>
    </section>
  )
}

export default ScanUploadPanel
