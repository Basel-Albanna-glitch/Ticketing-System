import client from './client'

export async function fetchProjects(page = 1, search = '') {
  const params = { page }
  if (search) params.search = search
  const { data } = await client.get('/projects/', { params })
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
