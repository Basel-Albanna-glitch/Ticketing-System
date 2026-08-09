import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createTodo,
  deleteTodo,
  fetchTodoCalendar,
  fetchTodos,
  reorderTodos,
  updateTodo,
} from '../api/todos'

const KEY = ['todos']

export function useTodos(filters = {}) {
  return useQuery({
    queryKey: [...KEY, filters],
    queryFn: () => fetchTodos(filters),
    placeholderData: (previousData) => previousData,
  })
}

export function useTodoCalendar({ from, to, enabled = true }) {
  return useQuery({
    queryKey: ['todo-calendar', from, to],
    queryFn: () => fetchTodoCalendar({ from, to }),
    enabled: enabled && Boolean(from && to),
    placeholderData: (previousData) => previousData,
  })
}

function useInvalidateTodos() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: KEY })
}

export function useCreateTodo() {
  const invalidate = useInvalidateTodos()
  return useMutation({ mutationFn: createTodo, onSuccess: invalidate })
}

export function useUpdateTodo() {
  const invalidate = useInvalidateTodos()
  return useMutation({
    mutationFn: ({ id, ...payload }) => updateTodo(id, payload),
    onSuccess: invalidate,
  })
}

export function useDeleteTodo() {
  const invalidate = useInvalidateTodos()
  return useMutation({ mutationFn: deleteTodo, onSuccess: invalidate })
}

// Applied to the cache first: a row that springs back while the request flies reads
// as a failed drag.
export function useReorderTodos(filters = {}) {
  const queryClient = useQueryClient()
  const key = [...KEY, filters]
  return useMutation({
    mutationFn: reorderTodos,
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData(key)
      queryClient.setQueryData(key, (old) => {
        if (!old) return old
        const byId = new Map(old.map((item) => [item.id, item]))
        return ids.map((id) => byId.get(id)).filter(Boolean)
      })
      return { previous }
    },
    onError: (_err, _ids, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}
