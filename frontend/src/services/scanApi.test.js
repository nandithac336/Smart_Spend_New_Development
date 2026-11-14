import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from './api.js'
import { confirmScan, listScans, updateScanDraft, uploadScan } from './scanApi.js'

vi.mock('./api.js', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

describe('scan API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it.each(['receipt', 'upi'])('uploads an image to the existing %s endpoint', async (type) => {
    const file = new File(['image'], 'capture.png', { type: 'image/png' })
    api.post.mockResolvedValue({ data: { data: { id: 'scan-1', type } } })

    await expect(uploadScan(type, file)).resolves.toMatchObject({ id: 'scan-1', type })

    const [url, body] = api.post.mock.calls[0]
    expect(url).toBe(`/scans/${type}`)
    expect(body.get('image')).toBe(file)
  })

  it('recovers the backend-retained draft when OCR fails', async () => {
    const error = { response: { data: { error: { details: { scanId: 'scan-failed' } } } } }
    api.post.mockRejectedValue(error)
    api.get.mockResolvedValue({ data: { data: { id: 'scan-failed', extractionStatus: 'failed' } } })

    await expect(uploadScan('receipt', new File(['image'], 'capture.png', { type: 'image/png' }))).rejects.toBe(error)
    expect(api.get).toHaveBeenCalledWith('/scans/scan-failed')
    expect(error.scanDraft).toMatchObject({ id: 'scan-failed', extractionStatus: 'failed' })
  })

  it('uses the existing list, edit and explicit confirmation endpoints', async () => {
    api.get.mockResolvedValue({ data: { data: [{ id: 'scan-1' }], pagination: { page: 1 } } })
    api.patch.mockResolvedValue({ data: { data: { id: 'scan-1', extractionStatus: 'ready' } } })
    api.post.mockResolvedValue({ data: { data: { id: 'transaction-1' } } })

    await expect(listScans({ type: 'upi', page: 1 })).resolves.toMatchObject({
      scans: [{ id: 'scan-1' }],
      pagination: { page: 1 },
    })
    await updateScanDraft('scan-1', { amountPaise: 12050 })
    await confirmScan('scan-1', { type: 'expense', walletId: 'wallet-1' })

    expect(api.get).toHaveBeenCalledWith('/scans', { params: { type: 'upi', page: 1 } })
    expect(api.patch).toHaveBeenCalledWith('/scans/scan-1', { amountPaise: 12050 })
    expect(api.post).toHaveBeenCalledWith('/scans/scan-1/confirm', { type: 'expense', walletId: 'wallet-1' })
  })
})
