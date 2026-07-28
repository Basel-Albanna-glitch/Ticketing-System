import { useQuery } from '@tanstack/react-query'
import { fetchAgentPerformance, fetchReportsSummary } from '../api/reports'

export function useReportsSummary(range) {
  return useQuery({
    queryKey: ['reports', 'summary', range],
    queryFn: () => fetchReportsSummary(range),
    placeholderData: (previousData) => previousData,
  })
}

export function useAgentPerformance(range) {
  return useQuery({
    queryKey: ['reports', 'agent-performance', range],
    queryFn: () => fetchAgentPerformance(range),
    placeholderData: (previousData) => previousData,
  })
}
