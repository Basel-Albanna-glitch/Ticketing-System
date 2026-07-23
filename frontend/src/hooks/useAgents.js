import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createAgent, fetchAgents, updateAgent } from '../api/users'

export function useAgents({ enabled = true } = {}) {
  return useQuery({
    queryKey: ['agents'],
    queryFn: fetchAgents,
    enabled,
  })
}

export function useCreateAgent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createAgent,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agents'] }),
  })
}

export function useUpdateAgent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...payload }) => updateAgent(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agents'] }),
  })
}
