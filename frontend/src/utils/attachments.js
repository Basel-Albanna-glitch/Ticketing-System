const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'avif', 'heic']

// Whether an attachment can be shown inline. Trusts content_type when the server recorded
// one; older rows (and anything uploaded with a blank type) fall back to the extension.
export function isImageAttachment(attachment) {
  const type = attachment?.content_type || ''
  if (type) return type.startsWith('image/')
  const name = attachment?.original_filename || attachment?.file || ''
  return IMAGE_EXTENSIONS.includes(name.split('.').pop()?.toLowerCase())
}
