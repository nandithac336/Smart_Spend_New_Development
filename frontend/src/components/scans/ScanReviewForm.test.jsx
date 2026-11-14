import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ScanReviewForm from './ScanReviewForm.jsx'

vi.mock('@/hooks/useWallets.js', () => ({
  useWallets: () => ({
    data: { wallets: [{ id: 'wallet-1', name: 'Cash', archived: false }] },
    isLoading: false,
    isError: false,
  }),
}))

vi.mock('@/hooks/useCategories.js', () => ({
  useCategories: () => ({ data: [], isLoading: false, isError: false }),
}))

describe('ScanReviewForm', () => {
  afterEach(cleanup)

  function readyReceipt() {
    const timeZone = 'Asia/Kolkata'
    const transactionDate = new Date(Date.now() - 3_600_000)
    return {
      timeZone,
      scan: {
        id: 'scan-1',
        type: 'receipt',
        extractionStatus: 'ready',
        draftFields: {
          amountPaise: 12050,
          transactionDate: transactionDate.toISOString(),
          transactionType: 'expense',
        },
      },
    }
  }

  it('creates nothing before explicit confirmation and then saves the edited draft first', async () => {
    const { scan, timeZone } = readyReceipt()
    const onScanChange = vi.fn().mockResolvedValue(scan)
    const onConfirmed = vi.fn().mockResolvedValue({ data: { _id: 'transaction-1' } })
    render(
      <ScanReviewForm
        hasImagePreview
        onConfirmed={onConfirmed}
        onScanChange={onScanChange}
        scan={scan}
        timeZone={timeZone}
      />,
    )

    expect(onScanChange).not.toHaveBeenCalled()
    expect(onConfirmed).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText('Wallet'), { target: { value: 'wallet-1' } })
    fireEvent.change(screen.getByLabelText('Payment method'), { target: { value: 'upi' } })
    fireEvent.change(screen.getByLabelText('Merchant or recipient (optional)'), { target: { value: 'Cafe' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm and create transaction' }))

    await waitFor(() => expect(onConfirmed).toHaveBeenCalledOnce())
    expect(onScanChange).toHaveBeenCalledOnce()
    expect(onScanChange.mock.invocationCallOrder[0]).toBeLessThan(onConfirmed.mock.invocationCallOrder[0])
    expect(onScanChange).toHaveBeenCalledWith(scan, expect.objectContaining({ amountPaise: 12050 }))
    expect(onConfirmed).toHaveBeenCalledWith(
      scan,
      expect.objectContaining({ type: 'expense', walletId: 'wallet-1', merchant: 'Cafe' }),
    )
  })

  it('does not allow confirmation without the original image preview', () => {
    const { scan, timeZone } = readyReceipt()
    const onConfirmed = vi.fn()
    render(
      <ScanReviewForm
        hasImagePreview={false}
        onConfirmed={onConfirmed}
        onScanChange={vi.fn()}
        scan={scan}
        timeZone={timeZone}
      />,
    )

    expect(screen.getByRole('button', { name: 'Confirm and create transaction' })).toBeDisabled()
    expect(onConfirmed).not.toHaveBeenCalled()
    expect(screen.getByText(/re-select the original image/i)).toBeInTheDocument()
  })
})
