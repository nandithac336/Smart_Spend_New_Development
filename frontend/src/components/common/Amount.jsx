import { formatINR } from '@/lib/money.js'
import CountUp from '@/components/motion/CountUp.jsx'

const amountStyles = {
  income: { sign: '+', className: 'text-income' },
  expense: { sign: '−', className: 'text-expense' },
  neutral: { sign: '', className: 'text-foreground' },
}

function Amount({
  value,
  type = 'neutral',
  className = '',
  animated = false,
  minimumFractionDigits = 0,
  ...props
}) {
  const amountType = amountStyles[type] ? type : 'neutral'
  const style = amountStyles[amountType]
  const numericValue = Number(value)
  const usesAbsoluteValue = amountType === 'income' || amountType === 'expense'
  const displayValue = usesAbsoluteValue ? Math.abs(numericValue) : numericValue
  const colorClass = amountType === 'neutral' && numericValue < 0
    ? amountStyles.expense.className
    : style.className

  return (
    <span className={`tabular whitespace-nowrap font-semibold ${colorClass} ${className}`} {...props}>
      {animated
        ? <CountUp currency prefix={usesAbsoluteValue ? style.sign : ''} value={displayValue} />
        : `${usesAbsoluteValue ? style.sign : ''}${formatINR(displayValue, { minimumFractionDigits })}`}
    </span>
  )
}

export default Amount
