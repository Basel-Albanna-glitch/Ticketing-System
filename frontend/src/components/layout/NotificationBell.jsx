import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BellIcon } from '../ui/icons'
import useDismissOnOutsideClick from '../../hooks/useDismissOnOutsideClick'
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from '../../hooks/useNotifications'
import { useI18n } from '../../i18n/useI18n'
import { useAuth } from '../../auth/useAuth'
import { playNewTicketBeep, unlockBeep } from '../../utils/beep'

function timeAgo(iso) {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const mins = Math.floor(seconds / 60)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const seenIds = useRef(null)
  const navigate = useNavigate()
  const { t } = useI18n()
  const { user } = useAuth()
  const { data } = useNotifications()
  const markRead = useMarkNotificationRead()
  const markAll = useMarkAllNotificationsRead()

  const unread = data?.unread_count || 0
  const notifications = data?.results || []

  useDismissOnOutsideClick(ref, useCallback(() => setOpen(false), []), open)

  // Audio can't start before the page has seen a gesture, so arm it on the first one.
  useEffect(() => {
    const opts = { once: true }
    document.addEventListener('pointerdown', unlockBeep, opts)
    document.addEventListener('keydown', unlockBeep, opts)
    return () => {
      document.removeEventListener('pointerdown', unlockBeep, opts)
      document.removeEventListener('keydown', unlockBeep, opts)
    }
  }, [])

  // Beep when a new-ticket notification shows up in a poll. `null` means we haven't seen a
  // response yet — that first batch is history, not an arrival, so it stays silent.
  useEffect(() => {
    const results = data?.results
    if (!results) return
    const previous = seenIds.current
    seenIds.current = new Set(results.map((n) => n.id))
    if (!previous) return
    const arrived = results.some(
      (n) => n.kind === 'new_ticket' && !n.is_read && !previous.has(n.id)
    )
    if (arrived) playNewTicketBeep()
  }, [data])

  function handleClick(n) {
    if (!n.is_read) markRead.mutate(n.id)
    setOpen(false)
    if (n.ticket) navigate(`/tickets/${n.ticket}`)
    else if (n.todo) navigate(`/todo/${n.todo}/edit`)
    // A customer-scoped notification (license expiry) goes to that customer's profile,
    // but that page is staff-only — a customer reading their own alert gets their account.
    else if (n.customer) {
      navigate(user?.role === 'customer' ? '/account' : `/customers/${n.customer}`)
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={t('notifications.title')}
        className="relative rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-gray-100"
      >
        <BellIcon className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute end-0 z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-gray-200/70 bg-white shadow-soft-lg dark:border-white/10 dark:bg-gray-900">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-2 dark:border-white/10">
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('notifications.title')}</span>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => markAll.mutate()}
                className="text-xs text-indigo-600 hover:underline dark:text-indigo-400"
              >
                {t('notifications.markAllRead')}
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-gray-400 dark:text-gray-400">
                {t('notifications.empty')}
              </p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleClick(n)}
                  className={`flex w-full flex-col gap-0.5 border-b border-gray-100 px-4 py-3 text-start last:border-0 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800 ${
                    n.is_read ? '' : 'bg-indigo-50/50 dark:bg-indigo-900/10'
                  }`}
                >
                  <span className="flex items-start gap-2 text-sm text-gray-800 dark:text-gray-200">
                    {!n.is_read && (
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-600 dark:bg-indigo-400" />
                    )}
                    {n.message}
                  </span>
                  <span className="ps-0 text-xs text-gray-400 dark:text-gray-400">
                    {timeAgo(n.created_at)}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
