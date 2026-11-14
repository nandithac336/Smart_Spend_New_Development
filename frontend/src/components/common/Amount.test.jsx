import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import Amount from './Amount.jsx'

vi.mock('@/hooks/useMotionDisabled.js', () => ({ useMotionDisabled: () => false }))

describe('Amount', () => {
  it('shows signed positive, negative and zero neutral values', () => {
    const { container, rerender } = render(<Amount value={4000} />)
    expect(container.firstChild).toHaveTextContent('₹40')

    rerender(<Amount value={-4000} />)
    expect(container.firstChild).toHaveTextContent('-₹40')
    expect(container.firstChild).toHaveClass('text-expense')

    rerender(<Amount value={0} />)
    expect(container.firstChild).toHaveTextContent('₹0')
  })

  it('keeps explicit income and expense signs', () => {
    const { container, rerender } = render(<Amount type="income" value={4000} />)
    expect(container.firstChild).toHaveTextContent('+₹40')

    rerender(<Amount type="expense" value={4000} />)
    expect(container.firstChild).toHaveTextContent('−₹40')
  })

  it('exposes the final signed label while hiding the animated count from assistive technology', () => {
    const { container } = render(<Amount animated value={-4000} />)

    expect(container.querySelector('.sr-only')).toHaveTextContent('-₹40')
    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument()
  })
})
