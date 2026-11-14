import { cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import DashboardSpending from './DashboardSpending.jsx'

afterEach(cleanup)

function renderSpending({
  categories = [],
  expenses = 0,
  monthExpenses = [],
  recent = [],
} = {}) {
  return render(
    <MemoryRouter>
      <DashboardSpending
        animated={false}
        categories={categories}
        expenses={expenses}
        highlightedTransactionIds={new Set()}
        monthExpenses={monthExpenses}
        motionDisabled
        recent={recent}
        timeZone="Asia/Kolkata"
      />
    </MemoryRouter>,
  )
}

describe('DashboardSpending', () => {
  it('shows Buying books with its category, wallet, date, time and amount', () => {
    const txnDate = new Date().toISOString()
    const transaction = {
      id: 'books',
      type: 'expense',
      merchant: 'Buying books',
      note: 'Bookshop purchase',
      amount: 1500,
      txnDate,
      categoryId: { name: 'Education', icon: '📚' },
      walletId: { name: 'Cash' },
    }

    renderSpending({ monthExpenses: [transaction], recent: [transaction] })

    const expensesSection = screen.getByRole('region', { name: 'Where your money goes' })
    expect(within(expensesSection).getByText('Buying books')).toBeInTheDocument()
    expect(within(expensesSection).queryByText('Bookshop purchase')).not.toBeInTheDocument()
    expect(within(expensesSection).getByText(/Education · Cash · Today,/)).toBeInTheDocument()
    expect(within(expensesSection).getByText('−₹15')).toBeInTheDocument()
    expect(screen.getAllByText('Buying books', { selector: 'span' })).toHaveLength(2)
    const recentSection = screen.getByRole('region', { name: 'Recent activity' })
    expect(within(recentSection).getByText('Buying books')).toBeInTheDocument()
    expect(within(recentSection).getByText(/Education · Cash · Today,/)).toBeInTheDocument()
    expect(within(recentSection).getByText('−₹15')).toBeInTheDocument()
  })

  it('uses the saved note as the activity description when merchant is missing', () => {
    renderSpending({
      monthExpenses: [{
        id: 'noted',
        type: 'expense',
        merchant: '',
        note: 'Buying books',
        amount: 1500,
        txnDate: new Date().toISOString(),
        categoryId: { name: 'Education' },
        walletId: { name: 'Cash' },
      }],
    })

    const expensesSection = screen.getByRole('region', { name: 'Where your money goes' })
    expect(within(expensesSection).getByText('Buying books')).toBeInTheDocument()
    expect(within(expensesSection).getByText(/Education · Cash · Today,/)).toBeInTheDocument()
  })

  it('shows a useful fallback when the transaction has no description', () => {
    renderSpending({
      monthExpenses: [{
        id: 'no-description',
        type: 'expense',
        merchant: '  ',
        note: '',
        amount: 500,
        txnDate: new Date().toISOString(),
        categoryId: { name: 'Education' },
        walletId: { name: 'Cash' },
      }],
    })

    const expensesSection = screen.getByRole('region', { name: 'Where your money goes' })
    expect(within(expensesSection).getByText('Education', { exact: true })).toBeInTheDocument()
    expect(within(expensesSection).getByText(/Education · Cash · Today,/)).toBeInTheDocument()
  })

  it('shows an income category as the title when both description fields are empty', () => {
    renderSpending({
      recent: [{
        id: 'no-income-description',
        type: 'income',
        merchant: '',
        note: ' ',
        amount: 500,
        txnDate: new Date().toISOString(),
        categoryId: { name: 'Salary' },
        walletId: { name: 'Bank' },
      }],
    })

    expect(screen.getByText('Salary', { exact: true })).toBeInTheDocument()
  })

  it('shows empty states and zero-percent category bars when there are no expenses', () => {
    renderSpending({
      categories: [{ categoryId: 'education', name: 'Education', total: 0, count: 0 }],
      expenses: 0,
    })

    expect(screen.getByText('No expenses recorded this month yet.')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Education share of this month’s expenses' }))
      .toHaveAttribute('aria-valuenow', '0')
    expect(screen.queryByText('−₹NaN')).not.toBeInTheDocument()
  })
})
