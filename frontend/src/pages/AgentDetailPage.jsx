import { Link, useParams } from 'react-router-dom'
import Avatar from '../components/ui/Avatar'
import Badge from '../components/ui/Badge'
import Breadcrumbs from '../components/ui/Breadcrumbs'
import Card from '../components/ui/Card'
import EmptyState from '../components/ui/EmptyState'
import Pagination from '../components/ui/Pagination'
import ProgressBar from '../components/ui/ProgressBar'
import SectionHeader from '../components/ui/SectionHeader'
import Spinner from '../components/ui/Spinner'
import StatTile from '../components/ui/StatTile'
import StatusBadge from '../components/tickets/StatusBadge'
import PriorityBadge from '../components/tickets/PriorityBadge'
import Table from '../components/ui/Table'
import {
  BoardIcon,
  CheckCircleIcon,
  EnvelopeIcon,
  InboxIcon,
  TicketIcon,
  UserIcon,
} from '../components/ui/icons'
import { useAgent } from '../hooks/useAgents'
import { useProjects } from '../hooks/useProjects'
import { useTickets } from '../hooks/useTickets'
import { useI18n } from '../i18n/useI18n'
import { useState } from 'react'

export default function AgentDetailPage() {
  const { t } = useI18n()
  const { id } = useParams()
  const [page, setPage] = useState(1)
  const { data: agent, isLoading } = useAgent(id)
  // Tickets this agent is the primary assignee of, and projects they are on.
  const { data: tickets, isLoading: isLoadingTickets } = useTickets({ assigned_agent: id, page })
  const { data: projects } = useProjects(1, '', '', { assignees: id })

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    )
  }

  const projectRows = projects?.results || []

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs
        items={[
          { label: t('crumb.dashboard'), to: '/dashboard' },
          { label: t('nav.agents'), to: '/agents' },
          { label: agent?.full_name || t('nav.agents') },
        ]}
      />

      <Card className="bg-gradient-to-br from-indigo-50/70 to-white dark:from-indigo-500/10 dark:to-transparent">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar name={agent?.full_name} src={agent?.avatar} size="lg" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
                {agent?.full_name}
              </h1>
              <Badge color={agent?.is_active ? 'green' : 'gray'}>
                {t(agent?.is_active ? 'customers.active' : 'customers.inactive')}
              </Badge>
              {agent?.is_available && <Badge color="blue">{t('agents.available')}</Badge>}
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500 dark:text-gray-300">
              <span className="inline-flex items-center gap-1.5">
                <UserIcon className="h-4 w-4" />@{agent?.username}
              </span>
              {agent?.email && (
                <span className="inline-flex items-center gap-1.5">
                  <EnvelopeIcon className="h-4 w-4" />
                  {agent.email}
                </span>
              )}
              {agent?.date_joined && (
                <span>
                  {t('field.createdAt')}: {new Date(agent.date_joined).toLocaleDateString()}
                </span>
              )}
            </p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile
          label={t('agents.assigned')}
          value={agent?.assigned_count ?? 0}
          icon={InboxIcon}
          color="indigo"
        />
        <StatTile
          label={t('agents.resolved')}
          value={agent?.resolved_count ?? 0}
          icon={CheckCircleIcon}
          color="green"
        />
        <StatTile
          label={t('projects.title')}
          value={projectRows.length}
          icon={BoardIcon}
          color="purple"
        />
      </div>

      <Card>
        <SectionHeader icon={BoardIcon} title={t('projects.title')} />
        {projectRows.length ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {projectRows.map((project) => (
              <Link
                key={project.id}
                to={`/projects/${project.id}`}
                className="rounded-xl border border-gray-200/70 p-3 transition-colors hover:border-indigo-300 hover:bg-indigo-50/40 dark:border-white/10 dark:hover:border-indigo-400/30 dark:hover:bg-indigo-500/5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-gray-900 dark:text-gray-100">{project.name}</span>
                  <Badge color={project.status === 'closed' ? 'gray' : 'green'}>
                    {t(project.status === 'closed' ? 'projects.status.closed' : 'projects.status.open')}
                  </Badge>
                </div>
                {project.customer && (
                  <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-300">
                    {project.customer.full_name}
                    {project.branch ? ` · ${project.branch.name}` : ''}
                  </p>
                )}
                <ProgressBar
                  className="mt-2"
                  value={project.done_task_count || 0}
                  max={project.task_count || 0}
                  label={`${project.done_task_count || 0}/${project.task_count || 0} ${t('projects.tasksDone')}`}
                />
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState title={t('agents.noProjects')} />
        )}
      </Card>

      <Card>
        <SectionHeader icon={TicketIcon} title={t('nav.tickets')} />
        {isLoadingTickets ? (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        ) : tickets?.results?.length ? (
          <>
            <Table columns={[t('field.subject'), t('field.customer'), t('field.priority'), t('field.status')]}>
              {tickets.results.map((ticket) => (
                <tr key={ticket.id}>
                  <td className="px-4 py-2">
                    <Link
                      to={`/tickets/${ticket.id}`}
                      className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                      {ticket.subject}
                    </Link>
                    <span className="ms-2 font-mono text-[11px] text-gray-400 dark:text-gray-400">
                      {ticket.reference}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-300">
                    {ticket.customer?.full_name || ticket.guest_name || '—'}
                  </td>
                  <td className="px-4 py-2">
                    <PriorityBadge priority={ticket.priority} />
                  </td>
                  <td className="px-4 py-2">
                    <StatusBadge status={ticket.status} />
                  </td>
                </tr>
              ))}
            </Table>
            <Pagination
              page={page}
              count={tickets.count}
              hasNext={!!tickets.next}
              hasPrevious={!!tickets.previous}
              onPageChange={setPage}
            />
          </>
        ) : (
          <EmptyState title={t('agents.noTickets')} />
        )}
      </Card>
    </div>
  )
}
