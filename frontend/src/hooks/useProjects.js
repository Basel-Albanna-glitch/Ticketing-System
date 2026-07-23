import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createProject, deleteProject, fetchProject, fetchProjects, updateProject } from '../api/projects'

export function useProjects(page, search = '') {
  return useQuery({
    queryKey: ['projects', page, search],
    queryFn: () => fetchProjects(page, search),
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

export function useDeleteProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteProject,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
  })
}
