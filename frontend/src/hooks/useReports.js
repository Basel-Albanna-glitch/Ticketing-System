import { useQuery } from '@tanstack/react-query'
import { fetchAgentPerformance, fetchReportsSummary } from '../api/reports'

export function useReportsSummary() {
  return useQuery({
    queryKey: ['reports', 'summary'],
    queryFn: fetchReportsSummary,
  })
}

export function useAgentPerformance() {
  return useQuery({
    queryKey: ['reports', 'agent-performance'],
    queryFn: fetchAgentPerformance,
  })
}
