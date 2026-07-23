import client from './client'

export async function fetchReportsSummary() {
  const { data } = await client.get('/reports/summary/')
  return data
}

export async function fetchAgentPerformance() {
  const { data } = await client.get('/reports/agent-performance/')
  return data
}
