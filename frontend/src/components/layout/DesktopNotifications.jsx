import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { useMarkNotificationRead, useNotifications } from '../../hooks/useNotifications'
import { useI18n } from '../../i18n/useI18n'
import {
  desktopNotificationsActive,
  showDesktopNotification,
} from '../../utils/desktopNotifications'

// A heading for each kind; anything else (a status change, a to-do reminder) goes out under
// the app's name, with the message saying what happened.
const TITLE_KEYS = {
  new_ticket: 'notifications.newTicketTitle',
  assigned: 'notifications.assignedTitle',
  collaborator_added: 'notifications.collaboratorTitle',
  todo_assigned: 'notifications.todoAssignedTitle',
  license_expiry: 'notifications.licenseExpiryTitle',
}

// Raised one by one per poll, at most; beyond that a single summary, not a wall of toasts.
const MAX_INDIVIDUAL = 3

// Where following a notification leads: the same places the bell opens.
function targetFor(notification, user) {
  if (notification.ticket) return `/tickets/${notification.ticket}`
  if (notification.todo) return `/todo/${notification.todo}/edit`
  if (notification.customer) {
    return user?.role === 'customer' ? '/account' : `/customers/${notification.customer}`
  }
  return null
}

// Turns each new notification the bell receives into an operating-system notification, for
// anyone who has switched them on in Settings. Renders nothing; mounted once for the app.
export default function DesktopNotifications() {
  const { t } = useI18n()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { data } = useNotifications()
  const markRead = useMarkNotificationRead()
  const seenIds = useRef(null)

  useEffect(() => {
    const results = data?.results
    if (!results) return
    const previous = seenIds.current
    seenIds.current = new Set(results.map((n) => n.id))
    // The first batch after loading is history, not arrivals — the same rule the bell's
    // beep follows — so opening the app never replays everything unread.
    if (!previous || !desktopNotificationsActive()) return
    // Newest first from the API; raised oldest first so they stack in the order they happened.
    const arrived = results.filter((n) => !n.is_read && !previous.has(n.id)).reverse()
    if (!arrived.length) return

    arrived.slice(0, MAX_INDIVIDUAL).forEach((notification) => {
      const target = targetFor(notification, user)
      showDesktopNotification(t(TITLE_KEYS[notification.kind] || 'notifications.appName'), {
        body: notification.message,
        tag: `hermes-${notification.id}`,
        onClick: () => {
          markRead.mutate(notification.id)
          if (target) navigate(target)
        },
      })
    })
    if (arrived.length > MAX_INDIVIDUAL) {
      showDesktopNotification(t('notifications.appName'), {
        body: t('notifications.desktopMore').replace('{n}', arrived.length - MAX_INDIVIDUAL),
        tag: 'hermes-more',
      })
    }
    // Re-running for any of these is harmless: ids already seen are never raised twice.
  }, [data, user, navigate, t, markRead])

  return null
}
