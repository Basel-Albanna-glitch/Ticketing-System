import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../ui/Button'
import Modal from '../ui/Modal'
import { CheckCircleIcon, TicketIcon } from '../ui/icons'
import { useAuth } from '../../auth/useAuth'
import { useMarkNotificationRead, useNotifications } from '../../hooks/useNotifications'
import { useI18n } from '../../i18n/useI18n'

// The notifications that interrupt instead of waiting in the bell: a ticket handed to someone,
// and someone added to a ticket as a collaborator.
// Each maps to its dialog title. A to-do handed to someone interrupts the same way.
const ALERT_TITLES = {
  assigned: 'notifications.assignedTitle',
  collaborator_added: 'notifications.collaboratorTitle',
  todo_assigned: 'notifications.todoAssignedTitle',
}
const ALERT_KINDS = new Set(Object.keys(ALERT_TITLES))

// Interrupts an agent or admin when a ticket has been handed to them, or they've been added to
// one as a collaborator, instead of leaving it as one more line in the bell. It reads the same
// polled notifications the bell does, so it needs no channel of its own: each unread one is
// shown in turn until it is confirmed or opened, and both mark it read, so it never comes back.
export default function AssignmentAlert() {
  const { t } = useI18n()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { data } = useNotifications()
  const markRead = useMarkNotificationRead()
  // Ids already answered in this tab. Marking read is a round trip, and without this the
  // alert would reappear from the cached list until the refetch lands.
  const [handled, setHandled] = useState(() => new Set())

  const isStaff = user?.role === 'agent' || user?.role === 'admin'
  const pending = isStaff
    ? (data?.results || []).filter((n) => ALERT_KINDS.has(n.kind) && !n.is_read && !handled.has(n.id))
    : []
  // The list arrives newest first; take the oldest so a backlog reads in the order it happened.
  const current = pending[pending.length - 1]

  function answer(openIt) {
    setHandled((prev) => new Set(prev).add(current.id))
    markRead.mutate(current.id)
    if (!openIt) return
    if (current.todo) navigate(`/todo/${current.todo}/edit`)
    else if (current.ticket) navigate(`/tickets/${current.ticket}`)
  }

  if (!current) return null

  return (
    <Modal
      open
      // The ✕ counts as confirming: an alert that could be closed without being answered
      // would simply pop up again on the next poll.
      onClose={() => answer(false)}
      title={t(ALERT_TITLES[current.kind])}
      dismissOnBackdrop={false}
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
            {current.todo ? (
              <CheckCircleIcon className="h-5 w-5" />
            ) : (
              <TicketIcon className="h-5 w-5" />
            )}
          </span>
          <p className="pt-2 text-sm text-gray-700 dark:text-gray-300">{current.message}</p>
        </div>
        {pending.length > 1 && (
          <p className="text-xs text-gray-400 dark:text-gray-400">
            {t('notifications.assignedMore').replace('{n}', pending.length - 1)}
          </p>
        )}
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => answer(false)}>
            {t('notifications.confirm')}
          </Button>
          {(current.todo || current.ticket) && (
            <Button onClick={() => answer(true)}>
              {t(current.todo ? 'notifications.viewTodo' : 'notifications.viewTicket')}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}
