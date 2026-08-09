import client from './client'

export async function fetchTickets(filters = {}) {
  const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '' && v != null))
  const { data } = await client.get('/tickets/', { params })
  return data
}

export async function fetchTicket(id) {
  const { data } = await client.get(`/tickets/${id}/`)
  return data
}

// Tickets whose start_date falls inside [from, to] (YYYY-MM-DD), for the calendar grid.
// Unpaginated, so the whole visible month arrives in one response.
export async function fetchTicketCalendar({ from, to, ...filters }) {
  const params = Object.fromEntries(
    Object.entries(filters).filter(([key, v]) => key !== 'page' && v !== '' && v != null)
  )
  const { data } = await client.get('/tickets/calendar/', { params: { ...params, from, to } })
  return data
}

// Download the current filtered ticket list as an .xlsx file.
export async function exportTickets(filters = {}) {
  const params = Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v !== '' && v != null)
  )
  const { data } = await client.get('/tickets/export/', { params, responseType: 'blob' })
  return data
}

export async function createTicket({
  subject,
  description,
  category,
  priority,
  customerId,
  branchId,
  startDate,
  assignedAgentIds = [],
  attachments = [],
}) {
  const form = new FormData()
  form.append('subject', subject)
  form.append('description', description)
  form.append('category', category)
  if (priority) form.append('priority', priority)
  if (customerId) form.append('customer_id', customerId)
  if (branchId) form.append('branch_id', branchId)
  if (startDate) form.append('start_date', startDate)
  assignedAgentIds.forEach((id) => form.append('assigned_agent_ids', id))
  attachments.forEach((file) => form.append('attachments', file))
  const { data } = await client.post('/tickets/', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function updateTicketStatus(id, status, holdReason) {
  const payload = { status }
  if (holdReason !== undefined) payload.hold_reason = holdReason
  const { data } = await client.patch(`/tickets/${id}/status/`, payload)
  return data
}

// Work phases — the steps staff log while handling a ticket. Any number per ticket.
export async function addTicketPhase(id, body) {
  const { data } = await client.post(`/tickets/${id}/phases/`, { body })
  return data
}

export async function deleteTicketPhase(id, phaseId) {
  await client.delete(`/tickets/${id}/phases/${phaseId}/`)
}

// Edit a ticket's own details (subject, description, category, priority, start date).
export async function updateTicket(id, payload) {
  const { data } = await client.patch(`/tickets/${id}/`, payload)
  return data
}

export async function assignTicket(id, assignedAgent) {
  const { data } = await client.patch(`/tickets/${id}/assign/`, { assigned_agent: assignedAgent })
  return data
}

export async function setTicketCustomer(id, { customer, branch }) {
  const { data } = await client.patch(`/tickets/${id}/customer/`, { customer, branch })
  return data
}

export async function setTicketDeadline(id, dueAt) {
  const { data } = await client.patch(`/tickets/${id}/deadline/`, { due_at: dueAt })
  return data
}

export async function setTicketCollaborators(id, collaboratorIds) {
  const { data } = await client.patch(`/tickets/${id}/collaborators/`, {
    collaborators: collaboratorIds,
  })
  return data
}

export async function setTicketArticles(id, articleIds) {
  const { data } = await client.patch(`/tickets/${id}/articles/`, { articles: articleIds })
  return data
}

export async function postComment(id, { body, attachments = [] }) {
  const form = new FormData()
  form.append('body', body)
  attachments.forEach((file) => form.append('attachments', file))
  const { data } = await client.post(`/tickets/${id}/comments/`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function deleteTicket(id) {
  await client.delete(`/tickets/${id}/`)
}

export async function fetchActivity(id) {
  const { data } = await client.get(`/tickets/${id}/activity/`)
  return data
}

export async function fetchCategories() {
  const { data } = await client.get('/categories/')
  return data
}

export async function createCategory(payload) {
  const { data } = await client.post('/categories/', payload)
  return data
}

export async function updateCategory(id, payload) {
  const { data } = await client.patch(`/categories/${id}/`, payload)
  return data
}

export async function deleteCategory(id) {
  await client.delete(`/categories/${id}/`)
}

export async function fetchDashboard({ statuses, dateFrom, dateTo } = {}) {
  const params = {}
  if (statuses !== undefined) params.status = statuses.join(',')
  if (dateFrom) params.date_from = dateFrom
  if (dateTo) params.date_to = dateTo
  const { data } = await client.get('/dashboard/', { params })
  return data
}

// ---- Guest (no account) ----

export async function fetchPublicCategories() {
  const { data } = await client.get('/public/categories/')
  return data
}

export async function createGuestTicket({
  guestName,
  guestCompany,
  guestBranch,
  guestPhone,
  guestEmail,
  subject,
  description,
  category,
  priority,
  attachments = [],
}) {
  const form = new FormData()
  form.append('guest_name', guestName)
  if (guestCompany) form.append('guest_company', guestCompany)
  if (guestBranch) form.append('guest_branch', guestBranch)
  form.append('guest_phone', guestPhone)
  if (guestEmail) form.append('guest_email', guestEmail)
  form.append('subject', subject)
  form.append('description', description)
  form.append('category', category)
  if (priority) form.append('priority', priority)
  attachments.forEach((file) => form.append('attachments', file))
  const { data } = await client.post('/tickets/guest/', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

// Customer-satisfaction rating for a closed ticket (public, gated by the emailed token).
export async function fetchRatingTicket({ id, token }) {
  const { data } = await client.get('/tickets/rate/', { params: { ticket: id, token } })
  return data
}

export async function submitRating({ id, token, score, comment }) {
  const { data } = await client.post('/tickets/rate/', { ticket: id, token, score, comment })
  return data
}

export async function trackGuestTicket({ phone, reference }) {
  const { data } = await client.post('/tickets/guest/track/', { phone, reference })
  return data
}

export async function replyGuestTicket({ phone, reference, body }) {
  const { data } = await client.post('/tickets/guest/reply/', { phone, reference, body })
  return data
}

// Rate a closed guest ticket from the tracking page (verified by phone + reference).
export async function rateGuestTicket({ phone, reference, score, comment }) {
  const { data } = await client.post('/tickets/guest/rate/', { phone, reference, score, comment })
  return data
}

export async function fetchTicketSettings() {
  const { data } = await client.get('/settings/tickets/')
  return data
}

export async function updateTicketSettings(payload) {
  const { data } = await client.patch('/settings/tickets/', payload)
  return data
}
