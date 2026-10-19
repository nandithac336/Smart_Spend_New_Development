import { Banknote, CreditCard, Landmark, Smartphone } from 'lucide-react'

export const WALLET_TYPES = [
  { value: 'cash', label: 'Cash', icon: Banknote },
  { value: 'bank', label: 'Bank account', icon: Landmark },
  { value: 'upi', label: 'UPI', icon: Smartphone },
  { value: 'card', label: 'Card', icon: CreditCard },
]

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'debit_card', label: 'Debit card' },
  { value: 'credit_card', label: 'Credit card' },
  { value: 'net_banking', label: 'Net banking' },
]

export const USER_TYPES = [
  { value: 'student', label: 'Student' },
  { value: 'professional', label: 'Professional' },
  { value: 'homemaker', label: 'Homemaker' },
  { value: 'family', label: 'Family' },
  { value: 'business', label: 'Business' },
  { value: 'other', label: 'Other' },
]
