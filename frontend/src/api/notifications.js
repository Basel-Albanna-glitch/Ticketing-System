import client from './client'

export async function fetchNotifications() {
  const { data } = await client.get('/notifications/')
  return data
}

export async function markNotificationRead(id) {
  const { data } = await client.post(`/notifications/${id}/read/`)
  return data
}

export async function markAllNotificationsRead() {
  const { data } = await client.post('/notifications/mark-all-read/')
  return data
}
