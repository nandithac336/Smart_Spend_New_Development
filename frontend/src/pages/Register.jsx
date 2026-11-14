import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { AnimatePresence, m } from 'motion/react'
import { ArrowRight, BriefcaseBusiness, Check, Eye, EyeOff, GraduationCap, House, LockKeyhole, Mail, Phone, Sparkles, UserRound, Users } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { USER_TYPES } from '@/lib/constants.js'
import { registerSchema } from '@/lib/authSchemas.js'
import { getErrorMessage, getFieldErrors } from '@/lib/errors.js'
import { useAuth } from '@/hooks/useAuth.js'
import AuthInput from '@/components/common/AuthInput.jsx'
import AuthLayout from '@/components/layout/AuthLayout.jsx'
import Loader from '@/components/common/Loader.jsx'
import GlowButton from '@/components/common/GlowButton.jsx'
import { useMotionDisabled } from '@/hooks/useMotionDisabled.js'
import PasswordStrength from '@/components/auth/PasswordStrength.jsx'
import { useDelayedAuthCommit } from '@/hooks/useDelayedAuthCommit.js'

function Register() {
  const [showPassword, setShowPassword] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [step, setStep] = useState(0)
  const [success, setSuccess] = useState(false)
  const [failedAttempt, setFailedAttempt] = useState(0)
  const { register: createAccount } = useAuth()
  const motionDisabled = useMotionDisabled()
  const delayAuthCommit = useDelayedAuthCommit(motionDisabled)
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    trigger,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', phone: '', password: '', userType: 'other' },
  })

  async function onSubmit(values) {
    setSubmitError('')
    try {
      const session = await createAccount({
        ...values,
        phone: values.phone || undefined,
      }, { hold: true })
      setSuccess(true)
      await delayAuthCommit(session.commit)
    } catch (error) {
      setFailedAttempt((attempt) => attempt + 1)
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
      if (
        error.response?.status === 409 ||
        Object.keys(fieldErrors).some((field) => ['name', 'email', 'phone', 'password'].includes(field))
      ) {
        setStep(0)
      }
    }
  }

  const password = watch('password')
  const userTypeRegistration = register('userType')
  const userTypeIcons = {
    student: GraduationCap,
    professional: BriefcaseBusiness,
    homemaker: House,
    family: Users,
    business: BriefcaseBusiness,
    other: Sparkles,
  }

  async function goToNextStep() {
    const valid = await trigger(['name', 'email', 'phone', 'password'])
    if (valid) {
      setSubmitError('')
      setStep(1)
    }
  }

  function submitForm(event) {
    return handleSubmit(onSubmit)(event)
  }

  return (
    <AuthLayout className="max-w-lg" failedAttempt={failedAttempt}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Step {step + 1} of 2</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight">
              {step === 0 ? 'Create your account' : 'Who are you?'}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {step === 0 ? 'A few details to get started.' : 'Choose the description that fits you best.'}
            </p>
          </div>
          <div aria-label={`Step ${step + 1} of 2`} className="flex gap-1.5">
            {[0, 1].map((stepNumber) => (
              <span key={stepNumber} className={`h-1.5 w-7 rounded-full ${stepNumber <= step ? 'bg-primary' : 'bg-muted'}`} />
            ))}
          </div>
        </div>

        {submitError && (
          <div className="mt-5 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
            {submitError}
          </div>
        )}

        <form className="mt-6" noValidate onSubmit={submitForm}>
          <AnimatePresence initial={false} mode="wait">
            {step === 0 ? (
              <m.div
                animate={{ opacity: 1, x: 0 }}
                className="space-y-4"
                exit={{ opacity: 0, x: motionDisabled ? 0 : -18 }}
                initial={{ opacity: 0, x: motionDisabled ? 0 : 18 }}
                key="account-details"
                transition={{ duration: motionDisabled ? 0 : 0.22 }}
              >
                <AuthInput autoComplete="name" error={errors.name?.message} icon={UserRound} id="name" label="Name" {...register('name')} />
                <AuthInput autoComplete="email" error={errors.email?.message} icon={Mail} id="email" label="Email" type="email" {...register('email')} />
                <AuthInput autoComplete="tel" error={errors.phone?.message} icon={Phone} id="phone" inputMode="numeric" label="Phone (optional)" {...register('phone')} />
                <AuthInput
                  autoComplete="new-password"
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
                <PasswordStrength password={password} />
                <GlowButton
                  className="auth-submit flex h-12 w-full items-center justify-center gap-2 rounded-xl text-primary-foreground hover:text-primary-foreground"
                  disabled={isSubmitting}
                  onClick={goToNextStep}
                  type="button"
                >
                  Continue
                  <ArrowRight aria-hidden="true" className="size-4" />
                </GlowButton>
              </m.div>
            ) : (
              <m.div
                animate={{ opacity: 1, x: 0 }}
                className="space-y-4"
                exit={{ opacity: 0, x: motionDisabled ? 0 : 18 }}
                initial={{ opacity: 0, x: motionDisabled ? 0 : -18 }}
                key="user-type"
                transition={{ duration: motionDisabled ? 0 : 0.22 }}
              >
                <input type="hidden" {...userTypeRegistration} />
                <fieldset>
                  <legend className="mb-3 text-sm font-medium">Choose one</legend>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {USER_TYPES.map(({ value, label }) => {
                      const Icon = userTypeIcons[value]
                      const selected = watch('userType') === value
                      return (
                        <button
                          aria-pressed={selected}
                          className={`relative flex min-h-24 flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border p-3 text-sm font-medium transition-colors ${selected ? 'border-primary/50 text-primary' : 'glass border-white/30 text-foreground hover:border-primary/30 dark:border-white/10'}`}
                          key={value}
                          onClick={() => setValue('userType', value, { shouldDirty: true, shouldValidate: true })}
                          type="button"
                        >
                          {selected && (
                            <m.span
                              className="absolute inset-0 rounded-2xl bg-primary/10"
                              layoutId="user-type-highlight"
                              transition={{ type: 'spring', stiffness: 360, damping: 30 }}
                            />
                          )}
                          <Icon aria-hidden="true" className="relative z-10 size-5" />
                          <span className="relative z-10">{label}</span>
                        </button>
                      )
                    })}
                  </div>
                  {errors.userType && <p className="mt-2 text-sm text-destructive" role="alert">{errors.userType.message}</p>}
                </fieldset>
                <div className="flex gap-3 pt-1">
                  <button
                    className="h-12 rounded-xl border border-border px-5 text-sm font-semibold transition-colors hover:bg-muted"
                    disabled={isSubmitting}
                    onClick={() => setStep(0)}
                    type="button"
                  >
                    Back
                  </button>
                  <GlowButton
                    className="auth-submit flex h-12 flex-1 items-center justify-center gap-2 rounded-xl"
                    disabled={isSubmitting}
                    type="submit"
                  >
                    {success ? <Check aria-hidden="true" className="size-5" /> : isSubmitting ? <Loader label="Creating account" /> : null}
                    {success ? 'Account created' : isSubmitting ? 'Creating account…' : 'Create account'}
                  </GlowButton>
                </div>
              </m.div>
            )}
          </AnimatePresence>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account? <Link className="font-semibold text-primary hover:underline" to="/login">Log in</Link>
        </p>
    </AuthLayout>
  )
}

export default Register
