import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth.js'
import GlassCard from '@/components/common/GlassCard.jsx'
import Loader from '@/components/common/Loader.jsx'
import { Button } from '@/components/ui/button.jsx'

function DashboardTemporary() {
  const { user, logout } = useAuth()
  const [error, setError] = useState('')
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  async function handleLogout() {
    setError('')
    setIsLoggingOut(true)
    try {
      await logout()
    } catch {
      setError('Could not contact the server to complete logout. Your local session has been cleared.')
    } finally {
      setIsLoggingOut(false)
    }
  }

  if (!user) return <Navigate to="/login" replace />

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <GlassCard className="w-full max-w-lg p-8" variant="strong">
        <p className="text-sm font-semibold text-primary">Temporary dashboard</p>
        <h1 className="mt-3 text-2xl font-bold">Welcome, {user.name}</h1>
        <p className="mt-2 text-sm text-muted-foreground">This placeholder will be replaced in Step 9.</p>
        {error && <p className="mt-4 text-sm text-destructive" role="alert">{error}</p>}
        <Button className="mt-6" disabled={isLoggingOut} onClick={handleLogout}>
          {isLoggingOut && <Loader className="mr-2" />}
          Log out
        </Button>
      </GlassCard>
    </main>
  )
}

export default DashboardTemporary
