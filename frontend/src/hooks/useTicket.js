import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addTicketPhase,
  assignTicket,
  deleteTicket,
  deleteTicketPhase,
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

// Query keys are compared structurally, so ['ticket', 11] and ['ticket', '11'] are two
// unrelated queries. Callers pass whichever id they happen to hold — a route param
// (string) or ticket.id off the payload (number) — so every key is built from the same
// normalised form. Without this, invalidating after a mutation silently missed the query
// the page was actually reading, and the change only appeared on the next poll.
const ticketKey = (id) => ['ticket', String(id)]

export function useTicket(id) {
  return useQuery({
    queryKey: ticketKey(id),
    queryFn: () => fetchTicket(id),
    enabled: !!id,
    refetchInterval: 15000, // live-update ticket detail (status, comments) every 15s
  })
}

export function useTicketActivity(id) {
  return useQuery({
    queryKey: [...ticketKey(id), 'activity'],
    queryFn: () => fetchActivity(id),
    enabled: !!id,
    refetchInterval: 15000, // live-update the activity timeline every 15s
  })
}

function useInvalidateTicket(id) {
  const queryClient = useQueryClient()
  return () => {
    // Prefix match, so this covers the detail query and its ['...','activity'] child.
    queryClient.invalidateQueries({ queryKey: ticketKey(id) })
    queryClient.invalidateQueries({ queryKey: ['tickets'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }
}

export function useAddTicketPhase(id) {
  const invalidate = useInvalidateTicket(id)
  return useMutation({
    mutationFn: (body) => addTicketPhase(id, body),
    onSuccess: invalidate,
  })
}

export function useDeleteTicketPhase(id) {
  const invalidate = useInvalidateTicket(id)
  return useMutation({
    mutationFn: (phaseId) => deleteTicketPhase(id, phaseId),
    onSuccess: invalidate,
  })
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
