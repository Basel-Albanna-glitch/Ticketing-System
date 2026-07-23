import client from './client'

export async function fetchSoftwareTypes() {
  const { data } = await client.get('/software-types/')
  return data
}

export async function createSoftwareType(payload) {
  const { data } = await client.post('/software-types/', payload)
  return data
}

export async function updateSoftwareType(id, payload) {
  const { data } = await client.patch(`/software-types/${id}/`, payload)
  return data
}

export async function deleteSoftwareType(id) {
  await client.delete(`/software-types/${id}/`)
  return id
}
