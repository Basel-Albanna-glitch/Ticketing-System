import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createSoftwareType,
  deleteSoftwareType,
  fetchSoftwareTypes,
  updateSoftwareType,
} from '../api/softwareTypes'

export function useSoftwareTypes() {
  return useQuery({
    queryKey: ['software-types'],
    queryFn: fetchSoftwareTypes,
  })
}

export function useCreateSoftwareType() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createSoftwareType,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['software-types'] }),
  })
}

export function useUpdateSoftwareType() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...payload }) => updateSoftwareType(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['software-types'] }),
  })
}

export function useDeleteSoftwareType() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteSoftwareType,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['software-types'] }),
  })
}
