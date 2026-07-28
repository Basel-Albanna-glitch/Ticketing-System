import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createArticle,
  deleteArticle,
  fetchArticle,
  fetchArticles,
  updateArticle,
} from '../api/articles'

export function useArticles(filters) {
  return useQuery({
    queryKey: ['articles', filters],
    queryFn: () => fetchArticles(filters),
  })
}

export function useArticle(id) {
  return useQuery({
    queryKey: ['article', id],
    queryFn: () => fetchArticle(id),
    enabled: !!id,
  })
}

function useInvalidateArticles() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: ['articles'] })
}

export function useCreateArticle() {
  const invalidate = useInvalidateArticles()
  return useMutation({ mutationFn: createArticle, onSuccess: invalidate })
}

export function useUpdateArticle() {
  const invalidate = useInvalidateArticles()
  return useMutation({
    mutationFn: ({ id, ...payload }) => updateArticle(id, payload),
    onSuccess: invalidate,
  })
}

export function useDeleteArticle() {
  const invalidate = useInvalidateArticles()
  return useMutation({ mutationFn: deleteArticle, onSuccess: invalidate })
}
