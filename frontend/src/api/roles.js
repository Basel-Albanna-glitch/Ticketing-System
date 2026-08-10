import client from './client'

// Staff roles: named bundles of permissions an admin assigns to agents and other
// admins. Managing them is restricted to admins who hold no role themselves, so
// these calls 403 for everyone else (see accounts.permissions.IsFullAdmin).

export async function fetchRoles() {
  const { data } = await client.get('/roles/')
  return data
}

export async function createRole(payload) {
  const { data } = await client.post('/roles/', payload)
  return data
}

export async function updateRole({ id, ...payload }) {
  const { data } = await client.patch(`/roles/${id}/`, payload)
  return data
}

export async function deleteRole(id) {
  await client.delete(`/roles/${id}/`)
  return id
}
