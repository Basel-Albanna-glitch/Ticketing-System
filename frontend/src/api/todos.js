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

// `ids` is the full list in its new order.
export async function reorderTodos(ids) {
  const { data } = await client.post('/todos/reorder/', { ids })
  return data
}
