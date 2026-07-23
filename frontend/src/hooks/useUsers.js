import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchAllUsers, updateUserRole } from '../api/users'

export function useAllUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: fetchAllUsers,
  })
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, role }) => updateUserRole(id, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  })
}
