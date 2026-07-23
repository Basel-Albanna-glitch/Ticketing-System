import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createTask, deleteTask, fetchTasks, updateTask } from '../api/projects'

export function useTasks(projectId) {
  return useQuery({
    queryKey: ['tasks', projectId],
    queryFn: () => fetchTasks(projectId),
    enabled: !!projectId,
  })
}

function useInvalidateTasks(projectId) {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: ['tasks', projectId] })
    queryClient.invalidateQueries({ queryKey: ['projects'] })
  }
}

export function useCreateTask(projectId) {
  const invalidate = useInvalidateTasks(projectId)
  return useMutation({
    mutationFn: createTask,
    onSuccess: invalidate,
  })
}

export function useUpdateTask(projectId) {
  const invalidate = useInvalidateTasks(projectId)
  return useMutation({
    mutationFn: ({ id, ...payload }) => updateTask(id, payload),
    onSuccess: invalidate,
  })
}

export function useDeleteTask(projectId) {
  const invalidate = useInvalidateTasks(projectId)
  return useMutation({
    mutationFn: deleteTask,
    onSuccess: invalidate,
  })
}
