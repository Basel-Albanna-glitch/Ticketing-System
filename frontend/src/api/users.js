import client from './client'

export async function fetchAgents() {
  const { data } = await client.get('/users/agents/')
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

export async function fetchCustomers() {
  const { data } = await client.get('/users/customers/')
  return data
}

// Builds the multipart body shared by create + full-profile update. `email`, `address`,
// `phone`, `tax_number`, `software_type` are always sent (empty string clears them); `password`
// only when provided. `licenses` fully replaces the customer's licenses; `attachments` are
// appended to any existing files.
function buildCustomerForm({
  full_name,
  email = '',
  password = '',
  address = '',
  phone = '',
  tax_number = '',
  software_type = '',
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
  form.append('software_type', software_type)
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
