import { useQuery } from '@tanstack/react-query'
import { fetchTicketCalendar } from '../api/tickets'

export function useTicketCalendar({ from, to, ...filters }) {
  return useQuery({
    queryKey: ['ticket-calendar', from, to, filters],
    queryFn: () => fetchTicketCalendar({ from, to, ...filters }),
    enabled: Boolean(from && to),
    placeholderData: (previousData) => previousData,
    refetchInterval: 30000,
  })
}
