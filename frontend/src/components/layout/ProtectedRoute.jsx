import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth.js'
import FullScreenLoader from './FullScreenLoader.jsx'
import ErrorState from '@/components/common/ErrorState.jsx'
import LogoutButton from './LogoutButton.jsx'

function ProtectedRoute({ children }) {
  const { status, retryBootstrap } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <FullScreenLoader />
  if (status === 'unavailable') {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <ErrorState
          description="Check your connection and try again. Your account is still saved on this device."
          onRetry={retryBootstrap}
          secondaryAction={<LogoutButton variant="ghost" />}
          title="Can't reach Smart Spend"
        />
      </main>
    )
  }
  if (status !== 'authenticated') {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return children ?? <Outlet />
}

export default ProtectedRoute
