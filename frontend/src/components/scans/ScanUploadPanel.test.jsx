import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ScanUploadPanel from './ScanUploadPanel.jsx'

describe('ScanUploadPanel', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('offers receipt and UPI modes, camera capture, and an image preview', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:scan-preview')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const onFileChange = vi.fn()
    const onTypeChange = vi.fn()
    const file = new File(['image'], 'receipt.png', { type: 'image/png' })
    render(
      <ScanUploadPanel
        error=""
        file={file}
        isUploading={false}
        onFileChange={onFileChange}
        onTypeChange={onTypeChange}
        onUpload={vi.fn()}
        type="receipt"
      />,
    )

    expect(screen.getByLabelText('Take a photo')).toHaveAttribute('capture', 'environment')
    expect(screen.getByRole('button', { name: 'Receipt' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'UPI screenshot' })).toHaveAttribute('aria-pressed', 'false')
    expect(await screen.findByRole('img', { name: 'Selected image preview' })).toHaveAttribute('src', 'blob:scan-preview')
    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalledWith(file))
  })

  it('rejects unsupported image types before upload', () => {
    const onFileChange = vi.fn()
    render(
      <ScanUploadPanel
        error=""
        file={null}
        isUploading={false}
        onFileChange={onFileChange}
        onTypeChange={vi.fn()}
        onUpload={vi.fn()}
        type="upi"
      />,
    )

    const file = new File(['document'], 'receipt.pdf', { type: 'application/pdf' })
    fireEvent.change(screen.getByLabelText('Choose image'), {
      target: { files: [file] },
    })

    expect(onFileChange).toHaveBeenCalledWith(file, 'Choose a JPEG, PNG, or WebP image.')
  })
})
