import { Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import Table from '../ui/Table'
import StatusBadge from './StatusBadge'
import PriorityBadge from './PriorityBadge'
import { useAuth } from '../../auth/useAuth'
import { useCategories } from '../../hooks/useCategories'
import { useI18n } from '../../i18n/useI18n'
import { TICKET_COLUMNS, visibleTicketColumns } from '../../constants/ticketColumns'

const LABEL_KEYS = Object.fromEntries(TICKET_COLUMNS.map((c) => [c.key, c.labelKey]))

const DATE_CELL = 'whitespace-nowrap px-4 py-2 text-gray-500 dark:text-gray-300'

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString() : '—'
}

export default function TicketTable({ tickets, sortBy, sortDir, onSort }) {
  const navigate = useNavigate()
  const { t } = useI18n()
  const { user } = useAuth()
  const { data: categories } = useCategories()
  const catById = new Map((categories || []).map((c) => [c.id, c]))

  // Split a ticket's category into a parent + child pair for display. If the category is a
  // sub-category, parent = its parent's name and child = the category itself; if it's a
  // top-level category, parent = that category and there's no child.
  function parentChild(cat) {
    if (!cat) return { parent: '—', child: '—' }
    if (cat.parent != null) {
      const parent = catById.get(cat.parent)
      return { parent: parent?.name || '—', child: cat.name }
    }
    return { parent: cat.name, child: '—' }
  }

  // How each column draws, keyed like TICKET_COLUMNS. sortKeys match the backend
  // ordering_fields; columns without one aren't sortable. Which columns appear is decided
  // per person (see visibleTicketColumns), which is also what keeps the assignment columns
  // from customers — the server withholds them.
  const CELLS = {
    created_at: {
      sortKey: 'created_at',
      render: (ticket) => (
        <td className="px-4 py-2 text-gray-500 dark:text-gray-300">
          {new Date(ticket.created_at).toLocaleDateString()}
        </td>
      ),
    },
    start_date: {
      sortKey: 'start_date',
      render: (ticket) => <td className={DATE_CELL}>{formatDate(ticket.start_date)}</td>,
    },
    assigned_at: {
      sortKey: 'assigned_at',
      render: (ticket) => <td className={DATE_CELL}>{formatDate(ticket.assigned_at)}</td>,
    },
    closed_at: {
      sortKey: 'closed_at',
      render: (ticket) => <td className={DATE_CELL}>{formatDate(ticket.closed_at)}</td>,
    },
    id: {
      sortKey: 'id',
      render: (ticket) => (
        <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-gray-500 dark:text-gray-300">
          #{ticket.id}
        </td>
      ),
    },
    subject: {
      sortKey: 'subject',
      render: (ticket) => (
        <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100">
          {/* Long subjects would stretch the row far wider than every other column, so
              clip with an ellipsis and keep the full text in the tooltip. */}
          <span className="block max-w-[14rem] truncate" title={ticket.subject}>
            {ticket.subject}
          </span>
        </td>
      ),
    },
    customer: {
      render: (ticket) => (
        <td className="px-4 py-2 text-gray-600 dark:text-gray-300">
          {ticket.customer ? (
            ticket.customer.full_name
          ) : (
            <span className="inline-flex items-center gap-1.5">
              {ticket.guest_name || t('tickets.guest')}
              <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-500 ring-1 ring-inset ring-gray-500/15 dark:bg-white/10 dark:text-gray-300 dark:ring-white/10">
                {t('tickets.guest')}
              </span>
            </span>
          )}
        </td>
      ),
    },
    parent_category: {
      render: (ticket) => (
        <td className="px-4 py-2 text-gray-600 dark:text-gray-300">
          {parentChild(ticket.category).parent}
        </td>
      ),
    },
    sub_category: {
      render: (ticket) => (
        <td className="px-4 py-2 text-gray-600 dark:text-gray-300">
          {parentChild(ticket.category).child}
        </td>
      ),
    },
    requested_priority: {
      sortKey: 'priority',
      render: (ticket) => (
        <td className="px-4 py-2">
          <PriorityBadge priority={ticket.priority} />
        </td>
      ),
    },
    customer_priority: {
      sortKey: 'customer__customer_priority',
      render: (ticket) => (
        <td className="px-4 py-2">
          {/* The customer's own ranking, set on their profile — blank for guests and for
              customers nobody has ranked. */}
          {ticket.customer_priority ? <PriorityBadge priority={ticket.customer_priority} /> : '—'}
        </td>
      ),
    },
    predefined_priority: {
      render: (ticket) => (
        <td className="px-4 py-2">
          {/* The resolved value: this ticket's override when it has one, else the
              category's. category_priority_override marks the ones lifted off. */}
          {ticket.category_priority ? (
            <span className="inline-flex items-center gap-1">
              <PriorityBadge priority={ticket.category_priority} variant="outline" />
              {ticket.category_priority_override && (
                <span
                  title={t('tickets.categoryPriorityHint')}
                  className="text-xs text-gray-400 dark:text-gray-400"
                >
                  *
                </span>
              )}
            </span>
          ) : (
            '—'
          )}
        </td>
      ),
    },
    status: {
      sortKey: 'status',
      render: (ticket) => (
        <td className="px-4 py-2">
          <StatusBadge status={ticket.status} assigned={Boolean(ticket.assigned_agent)} />
        </td>
      ),
    },
    assigned_agent: {
      render: (ticket) => (
        <td className="px-4 py-2 text-gray-600 dark:text-gray-300">
          {ticket.assigned_agent?.full_name || '—'}
        </td>
      ),
    },
  }

  // A column the server knows but this build doesn't draw is skipped rather than crashed on.
  const visible = visibleTicketColumns(user).filter((key) => CELLS[key])
  const columns = visible.map((key) => {
    const label = t(LABEL_KEYS[key])
    return CELLS[key].sortKey ? { label, sortKey: CELLS[key].sortKey } : label
  })

  return (
    <Table columns={columns} sortBy={sortBy} sortDir={sortDir} onSort={onSort}>
      {tickets.map((ticket) => {
        // Exactly the condition StatusBadge renders as "Unassigned": nobody has taken it on
        // yet, so it's flagged red as the row still waiting for someone.
        const isUnassigned = ticket.status === 'open' && !ticket.assigned_agent
        return (
          <tr
            key={ticket.id}
            onClick={() => navigate(`/tickets/${ticket.id}`)}
            // The Table wrapper sets a hover colour with a more specific selector, so the
            // red hover needs `!` to survive it.
            className={`cursor-pointer ${
              isUnassigned
                ? 'bg-red-100 hover:bg-red-200! dark:bg-red-950/30 dark:hover:bg-red-950/50!'
                : 'hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            {visible.map((key) => (
              <Fragment key={key}>{CELLS[key].render(ticket)}</Fragment>
            ))}
          </tr>
        )
      })}
    </Table>
  )
}
