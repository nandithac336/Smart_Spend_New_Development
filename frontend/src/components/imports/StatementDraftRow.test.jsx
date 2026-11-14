import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import StatementDraftRow from './StatementDraftRow.jsx'

const draft = {
  _id: 'draft-1',
  rowNumber: 2,
  txnDate: '2026-11-05T00:00:00.000Z',
  description: 'Tea shop',
  amountPaise: 12550,
  direction: 'debit',
  duplicateStatus: 'none',
  duplicateMatches: [],
  validationErrors: [],
  reviewStatus: 'pending',
}

describe('StatementDraftRow', () => {
  afterEach(cleanup)

  it('edits transaction fields and saves in backend date/paise form before selection', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue({ ...draft, description: 'Coffee' })
    render(<StatementDraftRow busy={false} categories={[]} draft={draft} editable onSave={onSave} onSelect={vi.fn()} onSkip={vi.fn()} selected={false} timeZone="Asia/Kolkata" />)
    expect(screen.getByText(/Debit:/)).toHaveTextContent('₹125.5')
    fireEvent.change(screen.getByLabelText('Date and time'), { target: { value: '2026-11-06T05:30' } })
    fireEvent.change(screen.getByLabelText('Description / merchant'), { target: { value: 'Coffee' } })
    fireEvent.change(screen.getByLabelText('Amount (₹)'), { target: { value: '250.50' } })
    expect(screen.getByLabelText('Select for import')).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Save edits' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledOnce())
    expect(onSave).toHaveBeenCalledWith(draft, expect.objectContaining({
      txnDate: '2026-11-06T00:00:00.000Z',
      amountPaise: 25050,
      direction: 'debit',
      description: 'Coffee',
    }))
    await waitFor(() => expect(screen.getByLabelText('Select for import')).toBeEnabled())
  })

  it('requires duplicate acknowledgement, and reports the backend candidate', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<StatementDraftRow busy={false} categories={[]} draft={{
      ...draft,
      duplicateStatus: 'possible',
      duplicateMatches: [{ transactionId: 'candidate-1', matchType: 'amount_date' }],
    }} editable onSave={vi.fn()} onSelect={onSelect} onSkip={vi.fn()} selected={false} timeZone="Asia/Kolkata" />)
    expect(screen.getByText(/Possible duplicate/)).toBeInTheDocument()
    expect(screen.getByText(/candidate-1 · amount date/)).toBeInTheDocument()
    const checkbox = screen.getByLabelText('Select for import')
    expect(checkbox).toBeDisabled()
    await user.click(screen.getByLabelText(/I reviewed the duplicate candidate/))
    expect(checkbox).toBeEnabled()
    await user.click(checkbox)
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ _id: 'draft-1' }), true, true)
  })

  it('blocks saving an invalid amount', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<StatementDraftRow busy={false} categories={[]} draft={{ ...draft, amountPaise: null }} editable onSave={onSave} onSelect={vi.fn()} onSkip={vi.fn()} selected={false} timeZone="Asia/Kolkata" />)
    await user.click(screen.getByRole('button', { name: 'Save edits' }))
    expect(screen.getByText(/positive amount/)).toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
  })
})
