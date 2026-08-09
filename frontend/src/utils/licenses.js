// Days from today until an ISO `YYYY-MM-DD` date, comparing calendar days rather than
// instants so a licence ending today reads as 0 regardless of the time of day.
export function daysUntil(isoDate) {
  if (!isoDate) return null
  const end = new Date(`${isoDate}T00:00:00`)
  if (Number.isNaN(end.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((end - today) / 86400000)
}

// Thresholds mirror the backend's reminder stages (notifications/licenses.py), so a row
// turns amber on the profile in the same week the first email goes out.
export function licenseStatus(endDate) {
  const days = daysUntil(endDate)
  if (days === null) return null
  if (days < 0) return { state: 'expired', days, color: 'red' }
  if (days === 0) return { state: 'today', days, color: 'red' }
  if (days <= 7) return { state: 'urgent', days, color: 'orange' }
  if (days <= 30) return { state: 'soon', days, color: 'amber' }
  return { state: 'active', days, color: 'green' }
}
