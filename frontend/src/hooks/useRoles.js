import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { createRole, deleteRole, fetchRoles, updateRole } from '../api/roles'
import { useAuth } from '../auth/useAuth'

/**
 * Refresh everything a role change can affect.
 *
 * The signed-in user is context state rather than a react-query entry, so it
 * needs an explicit refreshUser() — editing a role can change what *you* may do,
 * and the whole UI gates on the permissions the server resolved into /auth/me/.
 * The agent list is invalidated too, since it shows which role each person holds.
 */
function useRoleInvalidation() {
  const queryClient = useQueryClient()
  const { refreshUser } = useAuth()
  return async () => {
    queryClient.invalidateQueries({ queryKey: ['roles'] })
    queryClient.invalidateQueries({ queryKey: ['agents'] })
    await refreshUser()
  }
}

export function useRoles({ enabled = true } = {}) {
  return useQuery({
    queryKey: ['roles'],
    queryFn: fetchRoles,
    enabled,
  })
}

export function useCreateRole() {
  const onDone = useRoleInvalidation()
  return useMutation({ mutationFn: createRole, onSuccess: onDone })
}

export function useUpdateRole() {
  const onDone = useRoleInvalidation()
  return useMutation({ mutationFn: updateRole, onSuccess: onDone })
}

export function useDeleteRole() {
  const onDone = useRoleInvalidation()
  return useMutation({ mutationFn: deleteRole, onSuccess: onDone })
}
