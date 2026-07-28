import client from './client'

// Knowledge-base articles. List/detail are public (published only for non-staff);
// create/update/delete are admin-only.
export async function fetchArticles(params = {}) {
  const clean = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== '' && v != null)
  )
  const { data } = await client.get('/articles/', { params: clean })
  return data
}

export async function fetchArticle(id) {
  const { data } = await client.get(`/articles/${id}/`)
  return data
}

export async function createArticle(payload) {
  const { data } = await client.post('/articles/', payload)
  return data
}

export async function updateArticle(id, payload) {
  const { data } = await client.patch(`/articles/${id}/`, payload)
  return data
}

export async function deleteArticle(id) {
  await client.delete(`/articles/${id}/`)
}

// Attachments are uploaded separately from the article body so create/update stay JSON.
export async function uploadArticleAttachments(id, files) {
  const form = new FormData()
  files.forEach((file) => form.append('attachments', file))
  const { data } = await client.post(`/articles/${id}/attachments/`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function deleteArticleAttachment(id, attachmentId) {
  await client.delete(`/articles/${id}/attachments/${attachmentId}/`)
}
