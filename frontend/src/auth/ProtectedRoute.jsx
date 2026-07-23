import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './useAuth'

export default function ProtectedRoute({ allowedRoles }) {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 text-gray-400 dark:bg-gray-950 dark:text-gray-500">
        Loading...
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
