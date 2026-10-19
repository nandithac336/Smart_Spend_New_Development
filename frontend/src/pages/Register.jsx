import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { USER_TYPES } from '@/lib/constants.js'
import { registerSchema } from '@/lib/authSchemas.js'
import { getErrorMessage, getFieldErrors } from '@/lib/errors.js'
import { useAuth } from '@/hooks/useAuth.js'
import GlassCard from '@/components/common/GlassCard.jsx'
import Loader from '@/components/common/Loader.jsx'
import { Button } from '@/components/ui/button.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Label } from '@/components/ui/label.jsx'

function passwordStrength(password = '') {
  if (password.length >= 12 && /[A-Za-z]/.test(password) && /\d/.test(password)) return 'Strong'
  if (password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password)) return 'Good'
  if (password.length > 0) return 'Use 8–72 characters with at least one letter and one number'
  return 'Use 8–72 characters, including a letter and a number'
}

function Register() {
  const [showPassword, setShowPassword] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const { register: createAccount } = useAuth()
  const navigate = useNavigate()
  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', phone: '', password: '', userType: 'other' },
  })

  async function onSubmit(values) {
    setSubmitError('')
    try {
      await createAccount({
        ...values,
        phone: values.phone || undefined,
      })
      navigate('/dashboard', { replace: true })
    } catch (error) {
      const fieldErrors = getFieldErrors(error)
      Object.entries(fieldErrors).forEach(([field, message]) => {
        if (['name', 'email', 'phone', 'password', 'userType'].includes(field)) {
          setError(field, { type: 'server', message })
        }
      })

      const message = getErrorMessage(error, 'Unable to create your account.')
      if (error.response?.status === 409 || /already exists/i.test(message)) {
        setError('email', { type: 'server', message })
      } else if (Object.keys(fieldErrors).length === 0) {
        setSubmitError(message)
      }
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <GlassCard className="w-full max-w-lg p-6 sm:p-8" variant="strong">
        <Link className="text-sm font-semibold text-primary" to="/">Smart Spend</Link>
        <h1 className="mt-5 text-2xl font-bold">Create your account</h1>
        <p className="mt-1 text-sm text-muted-foreground">A few details to get started.</p>

        {submitError && (
          <div className="mt-5 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
            {submitError}
          </div>
        )}

        <form className="mt-6 space-y-4" noValidate onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input autoComplete="name" id="name" {...register('name')} aria-invalid={Boolean(errors.name)} />
            {errors.name && <p className="text-sm text-destructive" role="alert">{errors.name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input autoComplete="email" id="email" type="email" {...register('email')} aria-invalid={Boolean(errors.email)} />
            {errors.email && <p className="text-sm text-destructive" role="alert">{errors.email.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Input autoComplete="tel" id="phone" inputMode="numeric" {...register('phone')} aria-invalid={Boolean(errors.phone)} />
            {errors.phone && <p className="text-sm text-destructive" role="alert">{errors.phone.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="userType">Who are you?</Label>
            <select
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring"
              id="userType"
              {...register('userType')}
            >
              {USER_TYPES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
            </select>
            {errors.userType && <p className="text-sm text-destructive" role="alert">{errors.userType.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                autoComplete="new-password"
                className="pr-11"
                id="password"
                type={showPassword ? 'text' : 'password'}
                {...register('password')}
                aria-invalid={Boolean(errors.password)}
              />
              <button
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute inset-y-0 right-2 inline-flex items-center text-muted-foreground"
                onClick={() => setShowPassword((visible) => !visible)}
                type="button"
              >
                {showPassword ? <EyeOff aria-hidden="true" className="size-4" /> : <Eye aria-hidden="true" className="size-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground" aria-live="polite">
              Password strength: {passwordStrength(watch('password'))}
            </p>
            {errors.password && <p className="text-sm text-destructive" role="alert">{errors.password.message}</p>}
          </div>
          <Button className="w-full" disabled={isSubmitting} type="submit">
            {isSubmitting && <Loader className="mr-2" />}
            {isSubmitting ? 'Creating account…' : 'Create account'}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account? <Link className="font-semibold text-primary hover:underline" to="/login">Log in</Link>
        </p>
      </GlassCard>
    </main>
  )
}

export default Register
