import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import QuickAddSheet from './QuickAddSheet.jsx'
import { buildQuickAddFavorites } from './quickAddUtils.js'

const { create, remove, toast, createCategoryMutation } = vi.hoisted(() => ({
  create: vi.fn(),
  remove: vi.fn(),
  toast: vi.fn(),
  createCategoryMutation: vi.fn(),
}))

vi.mock('@/hooks/useCategories.js', () => ({
  useCategories: (type) => ({
    data: type === 'income'
      ? [{ _id: 'income-category', name: 'Salary', icon: '💼' }]
      : [{ _id: 'food-category', name: 'Food', icon: '🍲' }],
  }),
}))

vi.mock('@/hooks/useWallets.js', () => ({
  useWallets: () => ({
    data: {
      wallets: [{ _id: 'cash-wallet', name: 'Cash', type: 'cash', isDefault: true }],
    },
  }),
}))

vi.mock('@/hooks/useTransactions.js', () => ({
  useTransactions: () => ({ data: { pages: [{ data: [] }] } }),
}))

vi.mock('@/hooks/useTransactionMutations.js', () => ({
  useTransactionMutations: () => ({
    create: { isPending: false, mutateAsync: create },
    remove: { mutate: remove },
  }),
}))
vi.mock('@/hooks/useCreateCategory.js', () => ({
  useCreateCategory: () => ({ mutateAsync: createCategoryMutation, isPending: false }),
}))
vi.mock('@/hooks/useAuth.js', () => ({ useAuth: () => ({ user: null }) }))

vi.mock('sonner', () => ({ toast }))

describe('QuickAddSheet', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  beforeEach(() => {
    Object.defineProperties(HTMLElement.prototype, {
      hasPointerCapture: { configurable: true, value: () => false },
      setPointerCapture: { configurable: true, value: () => {} },
      releasePointerCapture: { configurable: true, value: () => {} },
    })
    Object.defineProperty(window.crypto, 'randomUUID', {
      configurable: true,
      value: vi.fn(() => 'cf702aa6-7775-46b2-a59c-493240f6e27e'),
    })
    window.localStorage.clear()
    create.mockResolvedValue({
      data: { _id: 'created-transaction' },
      duplicate: false,
    })
    createCategoryMutation.mockResolvedValue({
      _id: 'medical-category',
      name: 'Medical expenses',
      type: 'expense',
      icon: '🩺',
    })
  })

  it('saves a cash expense from keyboard amount input and offers Undo', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    render(<QuickAddSheet onOpenChange={onOpenChange} open />)

    await user.click(await screen.findByRole('button', { name: 'Food' }))
    fireEvent.keyDown(window, { key: '4' })
    fireEvent.keyDown(window, { key: '0' })
    await user.click(screen.getByRole('button', { name: 'Save', exact: true }))

    await waitFor(() => expect(create).toHaveBeenCalledOnce())
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      type: 'expense',
      amount: 4000,
      categoryId: 'food-category',
      walletId: 'cash-wallet',
      paymentMethod: 'cash',
      clientId: 'cf702aa6-7775-46b2-a59c-493240f6e27e',
      source: 'quickadd',
    }))
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    await waitFor(() => expect(toast).toHaveBeenCalledWith('₹40 added to Food', expect.objectContaining({
      action: expect.objectContaining({ label: 'Undo' }),
    })))
    toast.mock.calls[0][1].action.onClick()
    expect(remove).toHaveBeenCalledWith('created-transaction')
  })

  it('keeps the same client id after a failed save retry', async () => {
    const user = userEvent.setup()
    create.mockRejectedValueOnce(new Error('Network unavailable'))
      .mockResolvedValueOnce({ data: { _id: 'created-after-retry' }, duplicate: false })
    render(<QuickAddSheet onOpenChange={vi.fn()} open />)

    await user.click(await screen.findByRole('button', { name: 'Food' }))
    fireEvent.keyDown(window, { key: '4' })
    fireEvent.keyDown(window, { key: '0' })
    await user.click(screen.getByRole('button', { name: 'Save', exact: true }))
    await screen.findByText('Network unavailable')
    await user.click(screen.getByRole('button', { name: 'Save', exact: true }))

    await waitFor(() => expect(create).toHaveBeenCalledTimes(2))
    expect(create.mock.calls[0][0].clientId).toBe(create.mock.calls[1][0].clientId)
  })

  it('creates a custom category and saves its category id with a transaction', async () => {
    const user = userEvent.setup()
    render(<QuickAddSheet onOpenChange={vi.fn()} open />)

    await user.click(screen.getByRole('button', { name: 'Create category' }))
    await user.type(screen.getByRole('textbox', { name: 'New category name' }), 'Medical expenses')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Category icon' }), '🩺')
    await user.click(screen.getByRole('button', { name: 'Add', exact: true }))

    await waitFor(() => expect(createCategoryMutation).toHaveBeenCalledWith({
      name: 'Medical expenses',
      type: 'expense',
      icon: '🩺',
    }))
    fireEvent.keyDown(window, { key: '4' })
    fireEvent.keyDown(window, { key: '0' })
    await user.click(screen.getByRole('button', { name: 'Save', exact: true }))

    await waitFor(() => expect(create).toHaveBeenCalledWith(expect.objectContaining({
      categoryId: 'medical-category',
      amount: 4000,
    })))
  })

  it('selects an existing category case-insensitively without creating a duplicate', async () => {
    const user = userEvent.setup()
    render(<QuickAddSheet onOpenChange={vi.fn()} open />)

    await user.click(screen.getByRole('button', { name: 'Create category' }))
    await user.type(screen.getByRole('textbox', { name: 'New category name' }), ' food ')
    await user.click(screen.getByRole('button', { name: 'Add', exact: true }))
    expect(createCategoryMutation).not.toHaveBeenCalled()

    fireEvent.keyDown(window, { key: '4' })
    fireEvent.keyDown(window, { key: '0' })
    await user.click(screen.getByRole('button', { name: 'Save', exact: true }))
    await waitFor(() => expect(create).toHaveBeenCalledWith(expect.objectContaining({
      categoryId: 'food-category',
    })))
  })
})

describe('buildQuickAddFavorites', () => {
  it('returns at most five frequent merchant amount category combinations', () => {
    const transactions = [
      ...Array.from({ length: 3 }, () => ({
        type: 'expense',
        amount: 4000,
        merchant: 'Cafe',
        categoryId: { _id: 'food', name: 'Food', icon: '🍲' },
      })),
      {
        type: 'expense',
        amount: 4000,
        merchant: 'Cafe',
        categoryId: { _id: 'other', name: 'Other' },
      },
      {
        type: 'income',
        amount: 4000,
        merchant: 'Cafe',
        categoryId: { _id: 'food', name: 'Food' },
      },
    ]

    expect(buildQuickAddFavorites(transactions)).toEqual([
      expect.objectContaining({
        count: 3,
        merchant: 'Cafe',
        amount: 4000,
        categoryId: 'food',
      }),
    ])
  })
})
