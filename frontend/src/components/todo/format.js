// Display helpers shared by the to-do list and the to-do form.

// 2048 -> "2 KB". Whole units only: a file listing is scanned, not audited.
export function formatBytes(bytes) {
  if (!bytes) return '0 KB'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// 330 -> "5h 30m"; 90 -> "1h 30m"; 45 -> "45m"
export function formatDuration(minutes, t) {
  if (minutes == null) return null
  const abs = Math.max(0, minutes)
  const days = Math.floor(abs / 1440)
  const hours = Math.floor((abs % 1440) / 60)
  const mins = abs % 60
  const parts = []
  if (days) parts.push(`${days}${t('todo.dayShort')}`)
  if (hours) parts.push(`${hours}${t('todo.hourShort')}`)
  if (mins || !parts.length) parts.push(`${mins}${t('todo.minuteShort')}`)
  return parts.join(' ')
}
