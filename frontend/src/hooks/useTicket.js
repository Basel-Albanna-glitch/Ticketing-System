import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  assignTicket,
  deleteTicket,
  fetchActivity,
  fetchTicket,
  postComment,
  setTicketArticles,
  setTicketCollaborators,
  setTicketCustomer,
  setTicketDeadline,
  updateTicket,
  updateTicketStatus,
} from '../api/tickets'

export function useTicket(id) {
  return useQuery({
    queryKey: ['ticket', id],
    queryFn: () => fetchTicket(id),
    enabled: !!id,
    refetchInterval: 15000, // live-update ticket detail (status, comments) every 15s
  })
}

export function useTicketActivity(id) {
  return useQuery({
    queryKey: ['ticket', id, 'activity'],
    queryFn: () => fetchActivity(id),
    enabled: !!id,
    refetchInterval: 15000, // live-update the activity timeline every 15s
  })
}

function useInvalidateTicket(id) {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: ['ticket', id] })
    queryClient.invalidateQueries({ queryKey: ['ticket', id, 'activity'] })
    queryClient.invalidateQueries({ queryKey: ['tickets'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }
}

export function useUpdateTicketStatus(id) {
  const invalidate = useInvalidateTicket(id)
  return useMutation({
    mutationFn: ({ status, holdReason }) => updateTicketStatus(id, status, holdReason),
    onSuccess: invalidate,
  })
}

export function useUpdateTicket(id) {
  const invalidate = useInvalidateTicket(id)
  return useMutation({
    mutationFn: (payload) => updateTicket(id, payload),
    onSuccess: invalidate,
  })
}

export function useAssignTicket(id) {
  const invalidate = useInvalidateTicket(id)
  return useMutation({
    mutationFn: (assignedAgent) => assignTicket(id, assignedAgent),
    onSuccess: invalidate,
  })
}

export function useSetTicketCustomer(id) {
  const invalidate = useInvalidateTicket(id)
  return useMutation({
    mutationFn: (vars) => setTicketCustomer(id, vars),
    onSuccess: invalidate,
  })
}

export function useSetTicketDeadline(id) {
  const invalidate = useInvalidateTicket(id)
  return useMutation({
    mutationFn: (dueAt) => setTicketDeadline(id, dueAt),
    onSuccess: invalidate,
  })
}

export function useSetTicketCollaborators(id) {
  const invalidate = useInvalidateTicket(id)
  return useMutation({
    mutationFn: (ids) => setTicketCollaborators(id, ids),
    onSuccess: invalidate,
  })
}

export function useSetTicketArticles(id) {
  const invalidate = useInvalidateTicket(id)
  return useMutation({
    mutationFn: (ids) => setTicketArticles(id, ids),
    onSuccess: invalidate,
  })
}

export function useDeleteTicket(id) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => deleteTicket(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function usePostComment(id) {
  const invalidate = useInvalidateTicket(id)
  return useMutation({
    mutationFn: (payload) => postComment(id, payload),
    onSuccess: invalidate,
  })
}
