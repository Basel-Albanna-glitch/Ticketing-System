import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchTicketSettings, updateTicketSettings } from '../api/tickets'

export function useTicketSettings() {
  return useQuery({
    queryKey: ['ticket-settings'],
    queryFn: fetchTicketSettings,
  })
}

export function useUpdateTicketSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateTicketSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket-settings'] })
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
