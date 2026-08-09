import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createAgent, fetchAgent, fetchAgents, updateAgent } from '../api/users'

// `includeAdmins` is part of the key: the two lists differ, so they must not share a
// cache entry. Pass it wherever work gets assigned, so admins can assign themselves.
export function useAgents({ enabled = true, includeAdmins = false } = {}) {
  return useQuery({
    queryKey: ['agents', { includeAdmins }],
    queryFn: () => fetchAgents({ includeAdmins }),
    enabled,
  })
}

export function useAgent(id) {
  return useQuery({
    queryKey: ['agent', id],
    queryFn: () => fetchAgent(id),
    enabled: !!id,
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
