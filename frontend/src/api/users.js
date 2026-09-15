import client from './client'

// `includeAdmins` widens the list to admins as well, for assignment dropdowns where
// an admin should be able to pick themselves. The agents admin page leaves it off.
export async function fetchAgents({ includeAdmins = false } = {}) {
  const { data } = await client.get('/users/agents/', {
    params: includeAdmins ? { include_admins: 1 } : undefined,
  })
  return data
}

export async function fetchAgent(id) {
  const { data } = await client.get(`/users/agents/${id}/`)
  return data
}

export async function createAgent(payload) {
  const { data } = await client.post('/users/agents/', payload)
  return data
}

export async function updateAgent(id, payload) {
  const { data } = await client.patch(`/users/agents/${id}/`, payload)
  return data
}

// Admin-only: set or clear another user's profile picture (agents and customers alike).
export async function uploadUserAvatar(id, file) {
  const form = new FormData()
  form.append('avatar', file)
  const { data } = await client.post(`/users/${id}/avatar/`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function deleteUserAvatar(id) {
  const { data } = await client.delete(`/users/${id}/avatar/`)
  return data
}

export async function fetchCustomers() {
  const { data } = await client.get('/users/customers/')
  return data
}

// The logged-in customer's own full account detail (profile fields, licenses, branches with
// per-branch ticket counts, attachments, and ticket totals).
export async function fetchMyProfile() {
  const { data } = await client.get('/auth/me/profile/')
  return data
}

// Builds the multipart body shared by create + full-profile update. `email`, `address`,
// `phone`, `tax_number`, `customer_priority` are always sent (empty string clears them);
// `password` only when provided. `software_types` and `licenses` go JSON-encoded, since a multipart list has no
// way to say "empty", and each fully replaces what was there; `attachments` are appended to
// any existing files.
function buildCustomerForm({
  full_name,
  email = '',
  password = '',
  address = '',
  phone = '',
  tax_number = '',
  software_types = [],
  customer_priority = '',
  licenses = [],
  branches = [],
  attachments = [],
}) {
  const form = new FormData()
  if (full_name != null) form.append('full_name', full_name)
  form.append('email', email)
  form.append('address', address)
  form.append('phone', phone)
  form.append('tax_number', tax_number)
  form.append('software_types', JSON.stringify(software_types))
  form.append('customer_priority', customer_priority)
  if (password) form.append('password', password)
  form.append('licenses', JSON.stringify(licenses))
  form.append('branches', JSON.stringify(branches))
  attachments.forEach((file) => form.append('attachments', file))
  return form
}

export async function createCustomer({ username, ...rest }) {
  const form = buildCustomerForm(rest)
  form.append('username', username)
  const { data } = await client.post('/users/customers/', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function deleteCustomer(id) {
  await client.delete(`/users/customers/${id}/`)
  return id
}

// Full profile edit (scalar fields + license replacement + new attachments) via multipart.
export async function updateCustomerProfile(id, payload) {
  const form = buildCustomerForm(payload)
  const { data } = await client.patch(`/users/customers/${id}/`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

// Small field updates (e.g. the active/inactive toggle) as JSON. Deliberately does NOT touch
// licenses or attachments — omitting the `licenses` key leaves them untouched on the backend.
export async function updateCustomer(id, payload) {
  const { data } = await client.patch(`/users/customers/${id}/`, payload)
  return data
}

export async function fetchAllUsers() {
  const { data } = await client.get('/users/')
  return data
}

export async function updateUserRole(id, role) {
  const { data } = await client.patch(`/users/${id}/`, { role })
  return data
}
