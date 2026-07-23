import { useQuery } from '@tanstack/react-query'
import { fetchDashboard } from '../api/tickets'

export function useDashboard(filters) {
  return useQuery({
    queryKey: ['dashboard', filters],
    queryFn: () => fetchDashboard(filters),
    placeholderData: (previousData) => previousData,
    refetchInterval: 30000, // live-update dashboard stats every 30s
  })
}
