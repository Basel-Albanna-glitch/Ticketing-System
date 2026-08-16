import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createTodo,
  createTodoFolder,
  deleteTodo,
  deleteTodoAttachment,
  deleteTodoFolder,
  fetchTodo,
  fetchTodoCalendar,
  fetchTodoFolders,
  fetchTodos,
  reorderTodos,
  setTodoAssigneeDone,
  updateTodo,
  updateTodoFolder,
  uploadTodoAttachments,
} from '../api/todos'

const KEY = ['todos']
const FOLDER_KEY = ['todo-folders']

export function useTodos(filters = {}) {
  return useQuery({
    queryKey: [...KEY, filters],
    queryFn: () => fetchTodos(filters),
    placeholderData: (previousData) => previousData,
  })
}

// Keyed under ['todos'] so the mutations' blanket invalidation refreshes it too — an
// edit page left open after a change elsewhere should not show stale fields.
export function useTodo(id) {
  return useQuery({
    queryKey: [...KEY, 'detail', id],
    queryFn: () => fetchTodo(id),
    enabled: Boolean(id),
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
  // Folders carry a visible-item count, so anything that moves an item between them
  // — or in and out of one — has to refresh both.
  return () => {
    queryClient.invalidateQueries({ queryKey: KEY })
    queryClient.invalidateQueries({ queryKey: FOLDER_KEY })
  }
}

// Ticking the last outstanding share closes the to-do itself, so this invalidates the
// list as well as the item — the row has to move to Done.
export function useSetTodoAssigneeDone() {
  const invalidate = useInvalidateTodos()
  return useMutation({
    mutationFn: ({ id, userId, done }) => setTodoAssigneeDone(id, userId, done),
    onSuccess: invalidate,
  })
}

export function useUploadTodoAttachments() {
  const invalidate = useInvalidateTodos()
  return useMutation({
    mutationFn: ({ id, files }) => uploadTodoAttachments(id, files),
    onSuccess: invalidate,
  })
}

export function useDeleteTodoAttachment() {
  const invalidate = useInvalidateTodos()
  return useMutation({
    mutationFn: ({ id, attachmentId }) => deleteTodoAttachment(id, attachmentId),
    onSuccess: invalidate,
  })
}

export function useTodoFolders() {
  return useQuery({
    queryKey: FOLDER_KEY,
    queryFn: fetchTodoFolders,
    placeholderData: (previousData) => previousData,
  })
}

export function useCreateTodoFolder() {
  const invalidate = useInvalidateTodos()
  return useMutation({ mutationFn: createTodoFolder, onSuccess: invalidate })
}

export function useUpdateTodoFolder() {
  const invalidate = useInvalidateTodos()
  return useMutation({
    mutationFn: ({ id, ...payload }) => updateTodoFolder(id, payload),
    onSuccess: invalidate,
  })
}

export function useDeleteTodoFolder() {
  const invalidate = useInvalidateTodos()
  return useMutation({ mutationFn: deleteTodoFolder, onSuccess: invalidate })
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
        // `ids` covers one group, not the whole list. Rebuilding from it alone would
        // drop every other group from the cache until the refetch lands, so instead
        // the moved rows are dealt back into the slots they already occupied.
        const byId = new Map(old.map((item) => [item.id, item]))
        const moved = ids.map((id) => byId.get(id)).filter(Boolean)
        const inGroup = new Set(ids)
        let cursor = 0
        return old.map((item) => (inGroup.has(item.id) ? moved[cursor++] || item : item))
      })
      return { previous }
    },
    onError: (_err, _ids, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: KEY }),
  })
}
