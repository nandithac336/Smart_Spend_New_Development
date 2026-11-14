import { describe, expect, it } from 'vitest'
import {
  MAX_SCAN_IMAGE_BYTES,
  scanConfirmationPayload,
  scanDraftPayload,
  scanDraftValues,
  validateScanDraft,
  validateScanFile,
} from './scanForm.js'

describe('scan form helpers', () => {
  it('validates the supported image types and size boundary', () => {
    expect(validateScanFile(null)).toMatch(/Choose an image/)
    expect(validateScanFile({ type: 'application/pdf', size: 12 })).toMatch(/JPEG, PNG, or WebP/)
    expect(validateScanFile({ type: 'image/png', size: 0 })).toMatch(/empty/)
    expect(validateScanFile({ type: 'image/jpeg', size: MAX_SCAN_IMAGE_BYTES + 1 })).toMatch(/5 MB/)
    expect(validateScanFile({ type: 'image/webp', size: MAX_SCAN_IMAGE_BYTES })).toBe('')
  })

  it('converts receipt draft values to paise and keeps the selected transaction separate', () => {
    const values = {
      merchant: '  Corner store  ',
      amount: '120.50',
      transactionDate: '2026-10-12T15:45',
      type: 'expense',
      walletId: 'wallet-1',
      categoryId: 'category-1',
      paymentMethod: 'upi',
      note: 'Groceries',
      tax: '10.25',
      currency: 'INR',
      upiRef: '',
      paymentStatus: '',
      paymentDirection: '',
      allowPossibleDuplicate: false,
    }

    expect(scanDraftPayload(values, 'Asia/Kolkata')).toMatchObject({
      amountPaise: 12050,
      taxPaise: 1025,
      merchant: 'Corner store',
      currency: 'INR',
    })
    expect(scanConfirmationPayload(values)).toEqual({
      type: 'expense',
      walletId: 'wallet-1',
      categoryId: 'category-1',
      merchant: 'Corner store',
      note: 'Groceries',
      paymentMethod: 'upi',
      allowPossibleDuplicate: false,
    })
  })

  it('requires successful UPI payment and direction consistent with transaction type', () => {
    const values = {
      amount: '42.00',
      transactionDate: '2026-10-12T15:45',
      type: 'income',
      walletId: 'wallet-1',
      paymentMethod: 'upi',
      paymentStatus: 'pending',
      paymentDirection: 'out',
      currency: '',
    }
    const { errors } = validateScanDraft(values, 'upi', 'Asia/Kolkata')
    expect(errors.paymentStatus).toMatch(/successful payment/)
    expect(errors.type).toMatch(/match the UPI payment direction/)
  })

  it('accepts a cleared, incomplete draft without inventing transaction values', () => {
    const values = {
      amount: '',
      transactionDate: '',
      merchant: '',
      tax: '',
      currency: '',
      upiRef: '',
      paymentStatus: '',
      paymentDirection: '',
    }
    expect(validateScanDraft(values, 'receipt', 'Asia/Kolkata', { forConfirmation: false }).errors).toEqual({})
    expect(scanDraftPayload(values, 'Asia/Kolkata')).toMatchObject({
      amountPaise: null,
      transactionDate: null,
      merchant: null,
      taxPaise: null,
    })
  })

  it('formats an extracted amount in rupees when opening a saved draft', () => {
    const values = scanDraftValues(
      { type: 'receipt', draftFields: { amountPaise: 12050 } },
      'Asia/Kolkata',
      new Date('2026-10-12T10:15:00.000Z'),
    )
    expect(values.amount).toBe('120.50')
    expect(values.transactionDate).toBe('')
  })
})
