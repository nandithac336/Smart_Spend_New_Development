import { useState } from 'react'
import { LogOut } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth.js'
import { useOfflineSync } from '@/hooks/useOfflineSync.js'
import { Button } from '@/components/ui/button.jsx'
import Loader from '@/components/common/Loader.jsx'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog.jsx'

function LogoutButton({ className, variant = 'ghost', showLabel = true, ...buttonProps }) {
  const { logout, user } = useAuth()
  const sync = useOfflineSync(user?.id ?? user?._id)
  const [pending, setPending] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  async function handleLogout() {
    setPending(true)
    try {
      await logout()
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <Button
        className={className}
        disabled={pending}
        onClick={() => {
          if (sync.operations.length > 0) setConfirmOpen(true)
          else handleLogout()
        }}
        variant={variant}
        {...buttonProps}
      >
        {pending ? <Loader label="Signing out" /> : <LogOut aria-hidden="true" />}
        {showLabel && <span>{pending ? 'Signing out…' : 'Log out'}</span>}
      </Button>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Keep pending changes on this device?</AlertDialogTitle>
            <AlertDialogDescription>
              {sync.operations.length} queued transaction change{sync.operations.length === 1 ? '' : 's'} will remain saved for this account. They will not be sent under another account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay signed in</AlertDialogCancel>
            <AlertDialogAction onClick={handleLogout}>Log out and keep changes</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export default LogoutButton
