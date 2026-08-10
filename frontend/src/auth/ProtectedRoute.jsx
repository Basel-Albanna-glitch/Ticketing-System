import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './useAuth'

/**
 * Guards a branch of the router.
 *
 * `allowedRoles` gates on the kind of account; `requiredPermission` gates on a
 * name from the user's resolved permissions, which is what a role grants or
 * withholds. Hiding a nav link is not a guard — without this, typing the URL
 * still renders the page, and it would only fail once its requests came back
 * 403 with the layout already on screen.
 */
export default function ProtectedRoute({ allowedRoles, requiredPermission }) {
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

  // Customers are exempt, mirroring CanViewSection on the API: they hold no
  // staff permissions at all, so testing one here would lock them out of their
  // own portal. `allowedRoles` is what governs them.
  if (
    requiredPermission &&
    user.role !== 'customer' &&
    !user.permissions?.[requiredPermission]
  ) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
