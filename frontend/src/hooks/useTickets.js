import { useQuery } from '@tanstack/react-query'
import { fetchTickets } from '../api/tickets'

export function useTickets(filters) {
  return useQuery({
    queryKey: ['tickets', filters],
    queryFn: () => fetchTickets(filters),
    placeholderData: (previousData) => previousData,
    refetchInterval: 15000, // live-update the ticket list every 15s
  })
}
