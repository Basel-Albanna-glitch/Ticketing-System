import client from './client'

// `status` filters server-side; pass '' (or 'all') to include closed projects.
// `extra` carries any additional server-side filter, e.g. { assignees: 3 }.
export async function fetchProjects(page = 1, search = '', status = '', extra = {}) {
  const params = { page, ...extra }
  if (search) params.search = search
  if (status && status !== 'all') params.status = status
  const { data } = await client.get('/projects/', { params })
  return data
}

// Every project belonging to one customer, for their profile page.
export async function fetchCustomerProjects(customerId) {
  const { data } = await client.get('/projects/', { params: { customer: customerId } })
  return data.results ?? data
}

// Dated projects overlapping the calendar's visible window.
export async function fetchProjectCalendar({ from, to, ...filters }) {
  const { data } = await client.get('/projects/calendar/', { params: { from, to, ...filters } })
  return data
}

export async function fetchProject(id) {
  const { data } = await client.get(`/projects/${id}/`)
  return data
}

export async function createProject(payload) {
  const { data } = await client.post('/projects/', payload)
  return data
}

export async function updateProject(id, payload) {
  const { data } = await client.patch(`/projects/${id}/`, payload)
  return data
}

// Toggle yourself on or off a project's assignees.
export async function claimProject(id) {
  const { data } = await client.post(`/projects/${id}/claim/`)
  return data
}

export async function deleteProject(id) {
  await client.delete(`/projects/${id}/`)
}

export async function fetchTasks(projectId) {
  const { data } = await client.get('/tasks/', { params: { project: projectId } })
  return data
}

export async function createTask(payload) {
  const { data } = await client.post('/tasks/', payload)
  return data
}

export async function updateTask(id, payload) {
  const { data } = await client.patch(`/tasks/${id}/`, payload)
  return data
}

export async function deleteTask(id) {
  await client.delete(`/tasks/${id}/`)
}

// `ids` is the project's full task list in its new order.
export async function reorderTasks(projectId, ids) {
  const { data } = await client.post('/tasks/reorder/', { project: projectId, ids })
  return data
}
