import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  claimProject,
  createProject,
  deleteProject,
  fetchCustomerProjects,
  fetchProject,
  fetchProjectCalendar,
  fetchProjects,
  updateProject,
} from '../api/projects'

export function useCustomerProjects(customerId) {
  return useQuery({
    queryKey: ['customer-projects', customerId],
    queryFn: () => fetchCustomerProjects(customerId),
    enabled: !!customerId,
  })
}

export function useProjectCalendar({ from, to, enabled = true, ...filters }) {
  return useQuery({
    queryKey: ['project-calendar', from, to, filters],
    queryFn: () => fetchProjectCalendar({ from, to, ...filters }),
    enabled: enabled && Boolean(from && to),
    placeholderData: (previousData) => previousData,
  })
}

export function useProjects(page, search = '', status = '', extra = {}) {
  return useQuery({
    queryKey: ['projects', page, search, status, extra],
    queryFn: () => fetchProjects(page, search, status, extra),
    placeholderData: (previousData) => previousData,
  })
}

export function useProject(id) {
  return useQuery({
    queryKey: ['project', id],
    queryFn: () => fetchProject(id),
    enabled: !!id,
  })
}

export function useCreateProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createProject,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
  })
}

export function useUpdateProject(id) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload) => updateProject(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['project', id] })
    },
  })
}

export function useClaimProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: claimProject,
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['project', String(project.id)] })
    },
  })
}

export function useDeleteProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteProject,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
  })
}
