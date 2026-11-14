import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Check, Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { loginSchema } from '@/lib/authSchemas.js'
import { getErrorMessage, getFieldErrors } from '@/lib/errors.js'
import { useAuth } from '@/hooks/useAuth.js'
import AuthInput from '@/components/common/AuthInput.jsx'
import AuthLayout from '@/components/layout/AuthLayout.jsx'
import Loader from '@/components/common/Loader.jsx'
import GlowButton from '@/components/common/GlowButton.jsx'
import { useMotionDisabled } from '@/hooks/useMotionDisabled.js'
import { useDelayedAuthCommit } from '@/hooks/useDelayedAuthCommit.js'

function Login() {
  const [showPassword, setShowPassword] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [success, setSuccess] = useState(false)
  const [failedAttempt, setFailedAttempt] = useState(0)
  const { login } = useAuth()
  const delayAuthCommit = useDelayedAuthCommit(useMotionDisabled())
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } })

  async function onSubmit(credentials) {
    setSubmitError('')
    try {
      const session = await login(credentials, { hold: true })
      setSuccess(true)
      await delayAuthCommit(session.commit)
    } catch (error) {
      setFailedAttempt((attempt) => attempt + 1)
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

  function submitForm(event) {
    return handleSubmit(onSubmit)(event)
  }

  return (
    <AuthLayout failedAttempt={failedAttempt}>
        <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
        <p className="mt-1 text-sm text-muted-foreground">Log in to continue to your account.</p>

        {submitError && (
          <div className="mt-5 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
            {submitError}
          </div>
        )}

        <form className="mt-6 space-y-5" noValidate onSubmit={submitForm}>
          <AuthInput
            autoComplete="email"
            error={errors.email?.message}
            icon={Mail}
            id="email"
            label="Email"
            type="email"
            {...register('email')}
          />
          <AuthInput
            autoComplete="current-password"
            error={errors.password?.message}
            icon={LockKeyhole}
            id="password"
            label="Password"
            type={showPassword ? 'text' : 'password'}
            trailing={
              <button
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute inset-y-0 right-3 inline-flex items-center text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => setShowPassword((visible) => !visible)}
                type="button"
              >
                {showPassword ? <EyeOff aria-hidden="true" className="size-4" /> : <Eye aria-hidden="true" className="size-4" />}
              </button>
            }
            {...register('password')}
          />
          <GlowButton className="auth-submit flex h-12 w-full items-center justify-center gap-2 rounded-xl" disabled={isSubmitting} type="submit">
            {success ? <Check aria-hidden="true" className="size-5" /> : isSubmitting ? <Loader label="Logging in" /> : null}
            {success ? 'Signed in' : isSubmitting ? 'Logging in…' : 'Log in'}
          </GlowButton>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          New to Smart Spend? <Link className="font-semibold text-primary hover:underline" to="/register">Create an account</Link>
        </p>
    </AuthLayout>
  )
}

export default Login
