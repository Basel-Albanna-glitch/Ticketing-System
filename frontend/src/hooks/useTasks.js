import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createTask, deleteTask, fetchTasks, reorderTasks, updateTask } from '../api/projects'

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

// Reordering is applied to the cache immediately: a dropped row that springs back to
// its old spot while the request flies looks broken. On failure the snapshot is restored.
export function useReorderTasks(projectId) {
  const queryClient = useQueryClient()
  const key = ['tasks', projectId]
  return useMutation({
    mutationFn: (ids) => reorderTasks(projectId, ids),
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData(key)
      queryClient.setQueryData(key, (old) => {
        if (!old) return old
        const byId = new Map(old.map((task) => [task.id, task]))
        return ids.map((id) => byId.get(id)).filter(Boolean)
      })
      return { previous }
    },
    onError: (_err, _ids, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  })
}

export function useDeleteTask(projectId) {
  const invalidate = useInvalidateTasks(projectId)
  return useMutation({
    mutationFn: deleteTask,
    onSuccess: invalidate,
  })
}
