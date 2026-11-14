import { useCallback, useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { m } from 'motion/react'
import { Button } from '@/components/ui/button.jsx'
import { useMotionDisabled } from '@/hooks/useMotionDisabled.js'
import QuickAddSheet from '@/components/quickadd/QuickAddSheet.jsx'

function AddButton({ placement = 'floating' }) {
  const [open, setOpen] = useState(false)
  const [openSession, setOpenSession] = useState(0)
  const [firstTransactionSaved, setFirstTransactionSaved] = useState(
    () => window.localStorage.getItem('smart-spend:has-saved-transaction') === 'true',
  )
  const inNav = placement === 'nav'
  const motionDisabled = useMotionDisabled()

  const beginOpen = useCallback(() => {
    if (open) return
    setOpenSession((current) => current + 1)
    setOpen(true)
  }, [open])

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1024px)')
    const openQuickAdd = () => {
      if (desktop.matches === inNav) return
      beginOpen()
    }
    const handleShortcut = (event) => {
      const target = event.target
      const typing = target instanceof HTMLElement && (
        target.isContentEditable ||
        target.matches('input, textarea, select, [role="textbox"]')
      )
      if (
        desktop.matches &&
        !inNav &&
        !typing &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        event.key.toLowerCase() === 'n'
      ) {
        event.preventDefault()
        beginOpen()
      }
    }
    window.addEventListener('smart-spend:open-quick-add', openQuickAdd)
    window.addEventListener('keydown', handleShortcut)
    const stopPulse = () => setFirstTransactionSaved(true)
    window.addEventListener('smart-spend:transaction-saved', stopPulse)
    return () => {
      window.removeEventListener('smart-spend:open-quick-add', openQuickAdd)
      window.removeEventListener('keydown', handleShortcut)
      window.removeEventListener('smart-spend:transaction-saved', stopPulse)
    }
  }, [beginOpen, inNav, open])

  function toggleOpen() {
    if (open) setOpen(false)
    else beginOpen()
  }

  return (
    <>
      <Button
        aria-label={open ? 'Close quick add' : 'Add transaction'}
        className={inNav
          ? 'relative -mt-8 size-14 rounded-full border-4 border-background shadow-lg shadow-primary/25'
          : 'fixed bottom-8 right-8 z-30 hidden h-12 gap-2 rounded-2xl px-5 shadow-lg shadow-primary/25 lg:inline-flex'}
        onClick={toggleOpen}
        size={inNav ? 'icon-lg' : 'default'}
      >
        {!firstTransactionSaved && !motionDisabled && (
          <span aria-hidden="true" className="quick-add-pulse-ring absolute inset-0 rounded-full" />
        )}
        <m.span
          animate={{ rotate: open ? 45 : 0 }}
          className="inline-flex"
          transition={motionDisabled ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 24 }}
        >
          <Plus aria-hidden="true" className="size-5" />
        </m.span>
        {!inNav && <span> Add</span>}
      </Button>
      {openSession > 0 && (
        <QuickAddSheet key={openSession} open={open} onOpenChange={setOpen} />
      )}
    </>
  )
}

export default AddButton
