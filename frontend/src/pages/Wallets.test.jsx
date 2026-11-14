import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useMotionDisabled } from '@/hooks/useMotionDisabled.js'
import { useWalletMutations } from '@/hooks/useWalletMutations.js'
import { useWallets } from '@/hooks/useWallets.js'
import Wallets from './Wallets.jsx'

vi.mock('@/hooks/useWallets.js', () => ({ useWallets: vi.fn() }))
vi.mock('@/hooks/useWalletMutations.js', () => ({ useWalletMutations: vi.fn() }))
vi.mock('@/hooks/useMotionDisabled.js', () => ({ useMotionDisabled: vi.fn() }))

const walletList = [
  { id: 'cash-id', name: 'Daily cash', type: 'cash', balance: 12_500, openingBalance: 10_000, isDefault: true },
  { _id: 'bank-id', name: 'Savings bank', type: 'bank', balance: 80_000, openingBalance: 80_000, isDefault: false },
]

function createMutations() {
  return {
    create: { isPending: false, mutateAsync: vi.fn().mockResolvedValue({}) },
    update: { isPending: false, mutateAsync: vi.fn().mockResolvedValue({}) },
    archive: {
      isPending: false,
      mutate: vi.fn((_id, callbacks) => callbacks?.onSuccess?.()),
    },
    transfer: { isPending: false, mutateAsync: vi.fn().mockResolvedValue({}) },
  }
}

function renderWallets(wallets = walletList, overrides = {}) {
  useWallets.mockReturnValue({
    data: { wallets, totalBalance: wallets.reduce((total, wallet) => total + wallet.balance, 0) },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    ...overrides,
  })
  return render(<MemoryRouter><Wallets /></MemoryRouter>)
}

describe('Wallets page', () => {
  let mutations

  beforeEach(() => {
    cleanup()
    mutations = createMutations()
    useWalletMutations.mockReturnValue(mutations)
    useMotionDisabled.mockReturnValue(true)
  })

  afterEach(cleanup)

  it('shows loading, retryable error and empty states', async () => {
    renderWallets([], { isLoading: true })
    expect(screen.getByLabelText('Loading wallets')).toBeInTheDocument()
    cleanup()

    const refetch = vi.fn()
    renderWallets([], { isError: true, refetch })
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(refetch).toHaveBeenCalledOnce()
    cleanup()

    renderWallets([])
    expect(screen.getByRole('heading', { name: 'No wallets yet' })).toBeInTheDocument()
    expect(screen.getByText('₹0.00')).toBeInTheDocument()
  })

  it('shows backend balances and links to wallet-filtered transaction activity', () => {
    renderWallets()

    expect(screen.getByRole('heading', { name: 'My Wallets' })).toBeInTheDocument()
    expect(screen.getByLabelText('Total balance')).toHaveTextContent('₹925.00')
    expect(screen.getByText('2', { selector: 'p' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Daily cash' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Savings bank' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View activity for Daily cash' }))
      .toHaveAttribute('href', '/transactions?walletId=cash-id')
  })

  it('creates a wallet and closes the form after success', async () => {
    const user = userEvent.setup()
    renderWallets()

    await user.click(screen.getByRole('button', { name: 'Add wallet' }))
    await user.type(screen.getByLabelText('Name'), 'Travel UPI')
    await user.selectOptions(screen.getByLabelText('Type'), 'upi')
    await user.clear(screen.getByLabelText('Opening balance (₹)'))
    await user.type(screen.getByLabelText('Opening balance (₹)'), '50.25')
    await user.click(screen.getByRole('button', { name: 'Add wallet', exact: true }))

    await waitFor(() => expect(mutations.create.mutateAsync).toHaveBeenCalledWith({
      name: 'Travel UPI',
      type: 'upi',
      openingBalance: 5025,
    }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('edits a wallet and confirms archive before the mutation', async () => {
    const user = userEvent.setup()
    renderWallets()

    await user.click(screen.getByRole('button', { name: 'Edit Savings bank' }))
    await user.clear(screen.getByLabelText('Name'))
    await user.type(screen.getByLabelText('Name'), 'Reserve bank')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(mutations.update.mutateAsync).toHaveBeenCalledWith({
      id: 'bank-id',
      payload: { name: 'Reserve bank', type: 'bank', openingBalance: 80_000 },
    }))

    await user.click(screen.getByRole('button', { name: 'Archive Savings bank' }))
    expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Archive wallet' }))
    expect(mutations.archive.mutate).toHaveBeenCalledWith('bank-id', expect.objectContaining({
      onSuccess: expect.any(Function),
    }))
  })

  it('submits transfers through the wallet API and shows completion feedback', async () => {
    const user = userEvent.setup()
    renderWallets()

    await user.click(screen.getByRole('button', { name: 'Transfer money' }))
    await user.type(screen.getByLabelText('Amount (₹)'), '25')
    await user.click(screen.getByRole('button', { name: 'Transfer money', exact: true }))

    await waitFor(() => expect(mutations.transfer.mutateAsync).toHaveBeenCalledWith({
      fromWalletId: 'cash-id',
      toWalletId: 'bank-id',
      amount: 2500,
    }))
    expect(await screen.findByText('Transfer complete. Wallet balances have been updated.')).toBeInTheDocument()
  })
})
