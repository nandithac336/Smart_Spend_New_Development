import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import TransactionFormReferences from './TransactionFormReferences.jsx'

const { createCategory } = vi.hoisted(() => ({ createCategory: vi.fn() }))

vi.mock('@/hooks/useCreateCategory.js', () => ({
  useCreateCategory: () => ({ mutateAsync: createCategory, isPending: false }),
}))
vi.mock('react-hook-form', () => ({
  Controller: ({ name, render: renderField }) => renderField({
    field: { onChange: vi.fn(), value: name === 'walletId' ? 'wallet-1' : '' },
  }),
}))

function FormHarness() {
  const [categoryId, setCategoryId] = useState('')
  return (
    <>
      <output data-testid="selected-category">{categoryId}</output>
      <TransactionFormReferences
        categories={[]}
        categoriesError={false}
        categoriesLoading={false}
        control={{}}
        errors={{}}
        onCategoryCreated={(category) => setCategoryId(category.id ?? category._id)}
        refetchCategories={vi.fn()}
        refetchWallets={vi.fn()}
        type="expense"
        wallets={[{ id: 'wallet-1', name: 'Cash' }]}
        walletsError={false}
        walletsLoading={false}
      />
    </>
  )
}

describe('TransactionFormReferences', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('selects the created category ID in the standard transaction form', async () => {
    createCategory.mockResolvedValue({ _id: 'custom-category', name: 'Fuel', type: 'expense' })
    const user = userEvent.setup()
    render(<FormHarness />)

    await user.click(screen.getByRole('button', { name: 'Create category' }))
    await user.type(screen.getByRole('textbox', { name: 'New category name' }), 'Fuel')
    await user.click(screen.getByRole('button', { name: 'Add', exact: true }))

    await waitFor(() => expect(screen.getByTestId('selected-category')).toHaveTextContent('custom-category'))
    expect(createCategory).toHaveBeenCalledWith({ name: 'Fuel', type: 'expense', icon: '📦' })
  })
})
