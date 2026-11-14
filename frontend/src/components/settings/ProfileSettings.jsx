import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth.js'
import { USER_TYPES } from '@/lib/constants.js'
import { getErrorMessage, getFieldErrors } from '@/lib/errors.js'
import { Button } from '@/components/ui/button.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Label } from '@/components/ui/label.jsx'

const USER_TYPE_VALUES = ['student', 'professional', 'homemaker', 'family', 'business', 'other']
const TIME_ZONES = typeof Intl.supportedValuesOf === 'function'
  ? Intl.supportedValuesOf('timeZone')
  : ['Asia/Kolkata', 'UTC']

function isValidTimeZone(value) {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value })
    return true
  } catch {
    return false
  }
}

const profileSchema = z.object({
  name: z.string().trim().min(2, 'Use at least 2 characters.').max(60, 'Use 60 characters or fewer.'),
  phone: z.string().trim().refine(
    (value) => value === '' || /^[6-9]\d{9}$/.test(value),
    'Enter a valid 10-digit Indian mobile number.',
  ),
  userType: z.enum(USER_TYPE_VALUES),
  timezone: z.string().refine(isValidTimeZone, 'Choose a valid timezone.'),
})

function valuesFromUser(user) {
  return {
    name: user?.name ?? '',
    phone: user?.phone ?? '',
    userType: USER_TYPE_VALUES.includes(user?.userType) ? user.userType : 'other',
    timezone: user?.timezone ?? 'Asia/Kolkata',
  }
}

function FieldError({ id, children }) {
  return children ? <p className="mt-1 text-xs text-destructive" id={id} role="alert">{children}</p> : null
}

function ProfileSettings() {
  const { user, updateUser } = useAuth()
  const queryClient = useQueryClient()
  const [formError, setFormError] = useState('')
  const [saved, setSaved] = useState(false)
  const timeZones = user?.timezone && !TIME_ZONES.includes(user.timezone)
    ? [user.timezone, ...TIME_ZONES]
    : TIME_ZONES
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty, isSubmitting },
  } = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: valuesFromUser(user),
    mode: 'onBlur',
  })

  async function saveProfile(values) {
    setFormError('')
    setSaved(false)
    if (user?.phone && !values.phone.trim()) {
      setError('phone', {
        type: 'manual',
        message: 'The current account API does not support removing a saved phone number.',
      })
      return
    }

    const payload = {
      name: values.name.trim(),
      userType: values.userType,
      timezone: values.timezone,
      ...(values.phone.trim() ? { phone: values.phone.trim() } : {}),
    }

    try {
      const updatedUser = await updateUser(payload)
      await queryClient.invalidateQueries()
      reset(valuesFromUser(updatedUser))
      setSaved(true)
      toast.success('Profile updated')
    } catch (error) {
      const fieldErrors = getFieldErrors(error)
      for (const [field, message] of Object.entries(fieldErrors)) {
        if (['name', 'phone', 'userType', 'timezone'].includes(field)) {
          setError(field, { type: 'server', message })
        }
      }
      setFormError(getErrorMessage(error, 'Could not save your profile. Please try again.'))
    }
  }

  const timezoneField = register('timezone')
  const userTypeField = register('userType')
  const nameField = register('name')
  const phoneField = register('phone')

  return (
    <div className="glass-flat rounded-2xl border border-border/70 p-5 sm:p-6">
      <div className="mb-5">
        <h2 className="text-lg font-semibold">Profile</h2>
        <p className="mt-1 text-sm text-muted-foreground">Update the account details supported by your profile API.</p>
      </div>
      <form className="space-y-5" noValidate onSubmit={handleSubmit(saveProfile)}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="settings-name">Full name</Label>
            <Input
              aria-describedby={errors.name ? 'settings-name-error' : undefined}
              aria-invalid={Boolean(errors.name)}
              autoComplete="name"
              id="settings-name"
              maxLength={60}
              {...nameField}
            />
            <FieldError id="settings-name-error">{errors.name?.message}</FieldError>
          </div>
          <div className="space-y-2">
            <Label htmlFor="settings-email">Email address</Label>
            <Input id="settings-email" readOnly value={user?.email ?? ''} />
            <p className="text-xs text-muted-foreground">Email changes are not supported by the account API.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="settings-phone">Phone number</Label>
            <Input
              aria-describedby={errors.phone ? 'settings-phone-error' : 'settings-phone-help'}
              aria-invalid={Boolean(errors.phone)}
              autoComplete="tel"
              id="settings-phone"
              inputMode="numeric"
              maxLength={10}
              type="tel"
              {...phoneField}
            />
            <FieldError id="settings-phone-error">{errors.phone?.message}</FieldError>
            {!errors.phone && (
              <p className="text-xs text-muted-foreground" id="settings-phone-help">
                Optional. A saved phone number cannot currently be removed.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="settings-user-type">Account type</Label>
            <select
              aria-describedby={errors.userType ? 'settings-user-type-error' : undefined}
              aria-invalid={Boolean(errors.userType)}
              className="min-h-11 w-full rounded-xl border border-input bg-background/70 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              id="settings-user-type"
              {...userTypeField}
            >
              {USER_TYPES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
            </select>
            <FieldError id="settings-user-type-error">{errors.userType?.message}</FieldError>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="settings-timezone">Timezone</Label>
            <select
              aria-describedby={errors.timezone
                ? 'settings-timezone-error settings-timezone-help'
                : 'settings-timezone-help'}
              aria-invalid={Boolean(errors.timezone)}
              className="min-h-11 w-full rounded-xl border border-input bg-background/70 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              id="settings-timezone"
              {...timezoneField}
            >
              {timeZones.map((timezone) => <option key={timezone} value={timezone}>{timezone}</option>)}
            </select>
            <FieldError id="settings-timezone-error">{errors.timezone?.message}</FieldError>
            <p className="text-xs text-muted-foreground" id="settings-timezone-help">
              Used for transaction dates, reports and date-based notifications. Changing it does not change stored transaction values.
            </p>
          </div>
        </div>
        {formError && <p className="text-sm text-destructive" role="alert">{formError}</p>}
        {saved && <p className="text-sm text-primary" role="status">Profile updated successfully.</p>}
        <Button disabled={!isDirty || isSubmitting} type="submit">
          {isSubmitting ? 'Saving profile…' : 'Save profile'}
        </Button>
      </form>
    </div>
  )
}

export default ProfileSettings
