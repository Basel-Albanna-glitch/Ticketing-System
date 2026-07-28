import client from './client'

// `date_from` / `date_to` are YYYY-MM-DD; omitting both reports over all time.
function rangeParams({ dateFrom, dateTo } = {}) {
  const params = {}
  if (dateFrom) params.date_from = dateFrom
  if (dateTo) params.date_to = dateTo
  return params
}

export async function fetchReportsSummary(range) {
  const { data } = await client.get('/reports/summary/', { params: rangeParams(range) })
  return data
}

export async function fetchAgentPerformance(range) {
  const { data } = await client.get('/reports/agent-performance/', { params: rangeParams(range) })
  return data
}
