import { useNavigate } from 'react-router-dom'
import Table from '../ui/Table'
import StatusBadge from './StatusBadge'
import PriorityBadge from './PriorityBadge'
import { useAuth } from '../../auth/useAuth'
import { useCategories } from '../../hooks/useCategories'
import { useI18n } from '../../i18n/useI18n'

export default function TicketTable({ tickets, sortBy, sortDir, onSort }) {
  const navigate = useNavigate()
  const { t } = useI18n()
  const { user } = useAuth()
  const { data: categories } = useCategories()
  const catById = new Map((categories || []).map((c) => [c.id, c]))

  // Customers don't see who the ticket is assigned to.
  const showAssignedAgent = user?.role !== 'customer'

  // sortKeys match the backend ordering_fields; columns without one aren't sortable.
  const columns = [
    { label: t('field.createdAt'), sortKey: 'created_at' },
    { label: t('field.startDate'), sortKey: 'start_date' },
    ...(showAssignedAgent ? [{ label: t('field.assignedOn'), sortKey: 'assigned_at' }] : []),
    { label: t('field.id'), sortKey: 'id' },
    { label: t('field.reference') },
    { label: t('field.subject'), sortKey: 'subject' },
    t('field.customer'),
    t('tickets.parentCategory'),
    t('tickets.subCategory'),
    { label: t('tickets.customerPriority'), sortKey: 'priority' },
    t('tickets.categoryPriority'),
    { label: t('field.status'), sortKey: 'status' },
    ...(showAssignedAgent ? [t('field.assignedAgent')] : []),
  ]

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

  return (
    <Table columns={columns} sortBy={sortBy} sortDir={sortDir} onSort={onSort}>
      {tickets.map((ticket) => {
        const { parent, child } = parentChild(ticket.category)
        return (
          <tr
            key={ticket.id}
            onClick={() => navigate(`/tickets/${ticket.id}`)}
            className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <td className="px-4 py-2 text-gray-500 dark:text-gray-400">
              {new Date(ticket.created_at).toLocaleDateString()}
            </td>
            <td className="whitespace-nowrap px-4 py-2 text-gray-500 dark:text-gray-400">
              {ticket.start_date ? new Date(ticket.start_date).toLocaleDateString() : '—'}
            </td>
            {showAssignedAgent && (
              <td className="whitespace-nowrap px-4 py-2 text-gray-500 dark:text-gray-400">
                {ticket.assigned_at ? new Date(ticket.assigned_at).toLocaleDateString() : '—'}
              </td>
            )}
            <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-gray-500 dark:text-gray-400">
              #{ticket.id}
            </td>
            <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-gray-500 dark:text-gray-400">
              {ticket.reference || `#${ticket.id}`}
            </td>
            <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100">{ticket.subject}</td>
            <td className="px-4 py-2 text-gray-600 dark:text-gray-300">
              {ticket.customer ? (
                ticket.customer.full_name
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  {ticket.guest_name || t('tickets.guest')}
                  <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-500 ring-1 ring-inset ring-gray-500/15 dark:bg-white/10 dark:text-gray-400 dark:ring-white/10">
                    {t('tickets.guest')}
                  </span>
                </span>
              )}
            </td>
            <td className="px-4 py-2 text-gray-600 dark:text-gray-300">{parent}</td>
            <td className="px-4 py-2 text-gray-600 dark:text-gray-300">{child}</td>
            <td className="px-4 py-2">
              <PriorityBadge priority={ticket.priority} />
            </td>
            <td className="px-4 py-2">
              {ticket.category?.priority ? (
                <PriorityBadge priority={ticket.category.priority} variant="outline" />
              ) : (
                '—'
              )}
            </td>
            <td className="px-4 py-2">
              <StatusBadge status={ticket.status} assigned={Boolean(ticket.assigned_agent)} />
            </td>
            {showAssignedAgent && (
              <td className="px-4 py-2 text-gray-600 dark:text-gray-300">
                {ticket.assigned_agent?.full_name || '—'}
              </td>
            )}
          </tr>
        )
      })}
    </Table>
  )
}
