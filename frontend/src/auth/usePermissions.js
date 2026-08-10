import { useAuth } from './useAuth'

/**
 * What the signed-in user may do, as resolved by the server (see
 * accounts.serializers.MeSerializer).
 *
 * The server has already folded in whether they are an admin, which role they
 * hold, and the site-wide defaults, so callers ask a single question:
 *
 *   const { allow_agent_manage_kb } = usePermissions()
 *
 * rather than re-deriving `isAdmin || settings.allow_...` here. Re-deriving it
 * is how the UI and the API end up disagreeing about who may do what — and with
 * roles now able to narrow an admin, `isAdmin ||` is simply wrong.
 *
 * Returns an empty object while the user is still loading, so every permission
 * reads as falsy until we actually know.
 */
export function usePermissions() {
  const { user } = useAuth()
  return user?.permissions || {}
}
