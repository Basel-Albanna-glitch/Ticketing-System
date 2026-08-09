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

export async function fetchCustomerActivity(range) {
  const { data } = await client.get('/reports/customers/', { params: rangeParams(range) })
  return data
}

// Licenses are reported as of today, so this one takes no range.
export async function fetchLicenseReport() {
  const { data } = await client.get('/reports/licenses/')
  return data
}

// Download the whole report for the range as a multi-sheet .xlsx file.
export async function exportReport(range) {
  const { data } = await client.get('/reports/export/', {
    params: rangeParams(range),
    responseType: 'blob',
  })
  return data
}
