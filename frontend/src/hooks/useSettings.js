import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  changePassword,
  fetchNotificationPreferences,
  updateMe,
  updateNotificationPreferences,
} from '../api/auth'

export function useUpdateProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateMe,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['me'] }),
  })
}

export function useChangePassword() {
  return useMutation({ mutationFn: changePassword })
}

export function useNotificationPreferences() {
  return useQuery({
    queryKey: ['notification-preferences'],
    queryFn: fetchNotificationPreferences,
  })
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateNotificationPreferences,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notification-preferences'] }),
  })
}
