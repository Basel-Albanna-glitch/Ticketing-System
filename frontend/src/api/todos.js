import client from './client'

// Internal to-do list: one shared list for staff, unrelated to projects or customers.
export async function fetchTodos(filters = {}) {
  const { data } = await client.get('/todos/', { params: filters })
  return data
}

// Dated to-dos overlapping the calendar's visible window.
export async function fetchTodoCalendar({ from, to }) {
  const { data } = await client.get('/todos/calendar/', { params: { from, to } })
  return data
}

export async function createTodo(payload) {
  const { data } = await client.post('/todos/', payload)
  return data
}

export async function updateTodo(id, payload) {
  const { data } = await client.patch(`/todos/${id}/`, payload)
  return data
}

export async function deleteTodo(id) {
  await client.delete(`/todos/${id}/`)
}

// `ids` is one group's rows in their new order — a section, or a folder within one.
export async function reorderTodos(ids) {
  const { data } = await client.post('/todos/reorder/', { ids })
  return data
}

// Named groups of to-dos. Shared folders are the team's; private ones are yours alone.
export async function fetchTodoFolders() {
  const { data } = await client.get('/todo-folders/')
  return data
}

export async function createTodoFolder(payload) {
  const { data } = await client.post('/todo-folders/', payload)
  return data
}

export async function updateTodoFolder(id, payload) {
  const { data } = await client.patch(`/todo-folders/${id}/`, payload)
  return data
}

// The to-dos inside survive: the FK clears and they fall back to Ungrouped.
export async function deleteTodoFolder(id) {
  await client.delete(`/todo-folders/${id}/`)
}
