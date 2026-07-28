import client from './client'

export async function login(username, password) {
  const { data } = await client.post('/token/', { username, password })
  return data
}

export async function register({ fullName, username, email, password, confirmPassword }) {
  const { data } = await client.post('/auth/register/', {
    full_name: fullName,
    username,
    email,
    password,
    confirm_password: confirmPassword,
  })
  return data
}

export async function fetchMe() {
  const { data } = await client.get('/auth/me/')
  return data
}

export async function updateMe(payload) {
  const { data } = await client.patch('/auth/me/', payload)
  return data
}

// Profile picture. The server centre-crops and re-encodes whatever is sent, and returns the
// updated `me` payload with the new avatar URL.
export async function uploadMyAvatar(file) {
  const form = new FormData()
  form.append('avatar', file)
  const { data } = await client.post('/auth/me/avatar/', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function deleteMyAvatar() {
  const { data } = await client.delete('/auth/me/avatar/')
  return data
}

export async function changePassword(payload) {
  const { data } = await client.post('/auth/change-password/', payload)
  return data
}

export async function fetchNotificationPreferences() {
  const { data } = await client.get('/auth/notification-preferences/')
  return data
}

export async function updateNotificationPreferences(payload) {
  const { data } = await client.patch('/auth/notification-preferences/', payload)
  return data
}
