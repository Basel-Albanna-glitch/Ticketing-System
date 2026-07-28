import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createCustomer,
  deleteCustomer,
  fetchCustomers,
  fetchMyProfile,
  updateCustomer,
  updateCustomerProfile,
} from '../api/users'

export function useCustomers({ enabled = true } = {}) {
  return useQuery({
    queryKey: ['customers'],
    queryFn: fetchCustomers,
    enabled,
  })
}

// The logged-in customer's own account detail.
export function useMyProfile({ enabled = true } = {}) {
  return useQuery({
    queryKey: ['my-profile'],
    queryFn: fetchMyProfile,
    enabled,
  })
}

export function useCreateCustomer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createCustomer,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customers'] }),
  })
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...payload }) => updateCustomer(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customers'] }),
  })
}

export function useUpdateCustomerProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...payload }) => updateCustomerProfile(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customers'] }),
  })
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteCustomer,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customers'] }),
  })
}
