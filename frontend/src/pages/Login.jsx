import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { loginSchema } from '@/lib/authSchemas.js'
import { getErrorMessage, getFieldErrors } from '@/lib/errors.js'
import { useAuth } from '@/hooks/useAuth.js'
import GlassCard from '@/components/common/GlassCard.jsx'
import Loader from '@/components/common/Loader.jsx'
import { Button } from '@/components/ui/button.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Label } from '@/components/ui/label.jsx'

function Login() {
  const [showPassword, setShowPassword] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } })

  async function onSubmit(credentials) {
    setSubmitError('')
    try {
      await login(credentials)
      const destination = location.state?.from
      navigate(
        destination
          ? `${destination.pathname}${destination.search ?? ''}${destination.hash ?? ''}`
          : '/dashboard',
        { replace: true },
      )
    } catch (error) {
      const fieldErrors = getFieldErrors(error)
      Object.entries(fieldErrors).forEach(([field, message]) => {
        if (field === 'email' || field === 'password') {
          setError(field, { type: 'server', message })
        }
      })
      if (Object.keys(fieldErrors).length === 0) {
        setSubmitError(getErrorMessage(error, 'Unable to sign in. Please try again.'))
      }
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <GlassCard className="w-full max-w-md p-6 sm:p-8" variant="strong">
        <Link className="text-sm font-semibold text-primary" to="/">Smart Spend</Link>
        <h1 className="mt-5 text-2xl font-bold">Welcome back</h1>
        <p className="mt-1 text-sm text-muted-foreground">Log in to continue to your account.</p>

        {submitError && (
          <div className="mt-5 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
            {submitError}
          </div>
        )}

        <form className="mt-6 space-y-5" noValidate onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input autoComplete="email" id="email" type="email" {...register('email')} aria-invalid={Boolean(errors.email)} />
            {errors.email && <p className="text-sm text-destructive" role="alert">{errors.email.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                autoComplete="current-password"
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
            {errors.password && <p className="text-sm text-destructive" role="alert">{errors.password.message}</p>}
          </div>
          <Button className="w-full" disabled={isSubmitting} type="submit">
            {isSubmitting && <Loader className="mr-2" />}
            {isSubmitting ? 'Logging in…' : 'Log in'}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          New to Smart Spend? <Link className="font-semibold text-primary hover:underline" to="/register">Create an account</Link>
        </p>
      </GlassCard>
    </main>
  )
}

export default Login
