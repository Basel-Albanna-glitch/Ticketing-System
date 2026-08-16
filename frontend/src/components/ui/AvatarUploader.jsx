import { useEffect, useRef, useState } from 'react'
import Avatar from './Avatar'
import Button from './Button'
import { useI18n } from '../../i18n/useI18n'

const MAX_AVATAR_BYTES = 5 * 1024 * 1024

// Two modes, both entered by picking a file:
//   `onUpload` — the user already exists, so the file uploads straight away (no save step).
//   `onSelect` — the user doesn't exist yet (an admin filling in a create form). The file is
//                held and previewed locally; the caller uploads it once it has an id.
// `onDone` runs after a successful upload/removal so the caller can refresh what it shows.
export default function AvatarUploader({
  name,
  src,
  size = 'xl',
  onUpload,
  onSelect,
  onRemove,
  onDone,
  className = '',
}) {
  const { t } = useI18n()
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(null)

  // Object URLs are leaked memory until revoked.
  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview])

  function reject(file) {
    if (!file.type.startsWith('image/')) return t('settings.avatar.notImage')
    if (file.size > MAX_AVATAR_BYTES) return t('settings.avatar.tooLarge')
    return ''
  }

  async function handleFile(event) {
    const file = event.target.files?.[0]
    event.target.value = '' // let the same file be picked again after a failure
    if (!file) return
    const invalid = reject(file)
    setError(invalid)
    if (invalid) return

    if (onSelect) {
      setPreview((current) => {
        if (current) URL.revokeObjectURL(current)
        return URL.createObjectURL(file)
      })
      onSelect(file)
      return
    }

    setBusy(true)
    try {
      await onUpload(file)
      await onDone?.()
    } catch (err) {
      setError(err?.response?.data?.avatar || t('settings.avatar.uploadError'))
    } finally {
      setBusy(false)
    }
  }

  async function handleRemove() {
    if (onSelect) {
      setPreview((current) => {
        if (current) URL.revokeObjectURL(current)
        return null
      })
      onSelect(null)
      return
    }
    setBusy(true)
    setError('')
    try {
      await onRemove()
      await onDone?.()
    } catch {
      setError(t('settings.avatar.uploadError'))
    } finally {
      setBusy(false)
    }
  }

  const shown = preview || src
  const canRemove = Boolean(shown) && (onSelect || onRemove)

  return (
    <div className={`flex flex-wrap items-center gap-5 ${className}`}>
      <Avatar name={name} src={shown} size={size} />
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            loading={busy}
            onClick={() => inputRef.current?.click()}
          >
            {shown ? t('settings.avatar.change') : t('settings.avatar.upload')}
          </Button>
          {canRemove && (
            <Button type="button" variant="ghost" disabled={busy} onClick={handleRemove}>
              {t('common.remove')}
            </Button>
          )}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-300">
          {onSelect ? t('settings.avatar.hintOnCreate') : t('settings.avatar.hint')}
        </p>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  )
}
