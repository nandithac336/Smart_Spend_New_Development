import { useState } from 'react'
import { AnimatePresence, m } from 'motion/react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button.jsx'
import { Input } from '@/components/ui/input.jsx'
import { useCreateCategory } from '@/hooks/useCreateCategory.js'
import { useMotionDisabled } from '@/hooks/useMotionDisabled.js'
import { getErrorMessage } from '@/lib/errors.js'

const categoryIcons = ['📦', '🩺', '✈️', '🛍️', '🛒', '🧴', '⛽', '🎓', '🎬', '🏠']

function CategoryCreator({ type, categories, onCreated, disabled = false }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [icon, setIcon] = useState(categoryIcons[0])
  const [error, setError] = useState('')
  const motionDisabled = useMotionDisabled()
  const mutation = useCreateCategory()

  async function submit(event) {
    event.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Enter a category name.')
      return
    }

    const existing = categories.find((category) =>
      category.name.trim().toLowerCase() === trimmedName.toLowerCase(),
    )
    if (existing) {
      onCreated(existing)
      setName('')
      setError('')
      setOpen(false)
      return
    }

    setError('')
    try {
      const category = await mutation.mutateAsync({ name: trimmedName, type, icon })
      onCreated(category)
      setName('')
      setError('')
      setOpen(false)
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Could not create this category.'))
    }
  }

  return (
    <div className="space-y-2">
      <Button
        aria-expanded={open}
        disabled={disabled || mutation.isPending}
        onClick={() => { setOpen((current) => !current); setError('') }}
        size="sm"
        type="button"
        variant="outline"
      >
        <Plus aria-hidden="true" className="size-4" />
        Create category
      </Button>
      <AnimatePresence initial={false}>
        {open && (
          <m.form
            animate={motionDisabled ? { opacity: 1 } : { opacity: 1, height: 'auto' }}
            className="glass-flat grid gap-2 overflow-hidden rounded-xl border border-border/60 p-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]"
            exit={motionDisabled ? { opacity: 0 } : { opacity: 0, height: 0 }}
            initial={motionDisabled ? { opacity: 0 } : { opacity: 0, height: 0 }}
            onSubmit={submit}
            transition={motionDisabled ? { duration: 0.1 } : { duration: 0.18, ease: 'easeOut' }}
          >
            <Input
              aria-label="New category name"
              autoFocus
              maxLength={40}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Medical expenses"
              value={name}
            />
            <select
              aria-label="Category icon"
              className="h-10 rounded-xl border border-input bg-background px-3 text-sm text-foreground"
              onChange={(event) => setIcon(event.target.value)}
              value={icon}
            >
              {categoryIcons.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
            <Button disabled={mutation.isPending} type="submit">
              {mutation.isPending ? 'Saving…' : 'Add'}
            </Button>
            {error && <p className="text-xs text-destructive sm:col-span-3" role="alert">{error}</p>}
          </m.form>
        )}
      </AnimatePresence>
    </div>
  )
}

export default CategoryCreator
