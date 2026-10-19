import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth.js'
import FullScreenLoader from './FullScreenLoader.jsx'

function PublicOnlyRoute({ children }) {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <FullScreenLoader />
  if (status === 'authenticated') {
    const destination = location.state?.from
    const to = destination
      ? `${destination.pathname}${destination.search ?? ''}${destination.hash ?? ''}`
      : '/dashboard'
    return <Navigate to={to} replace />
  }

  return children ?? <Outlet />
}

export default PublicOnlyRoute
