import { useNavigate, useParams } from 'react-router-dom'
import Avatar from '../components/ui/Avatar'
import Badge from '../components/ui/Badge'
import Breadcrumbs from '../components/ui/Breadcrumbs'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import ProgressBar from '../components/ui/ProgressBar'
import SectionHeader from '../components/ui/SectionHeader'
import Spinner from '../components/ui/Spinner'
import StatTile from '../components/ui/StatTile'
import {
  BadgeIcon,
  BoardIcon,
  CalendarIcon,
  CheckCircleIcon,
  ClockIcon,
  InboxIcon,
  TrashIcon,
  UserIcon,
  UsersIcon,
} from '../components/ui/icons'
import ProjectRemark from '../components/projects/ProjectRemark'
import TaskList from '../components/projects/TaskList'
import { isOverdue } from '../components/projects/TaskCard'
import { useAuth } from '../auth/useAuth'
import { usePermissions } from '../auth/usePermissions'
import {
  useClaimProject,
  useDeleteProject,
  useProject,
  useUpdateProject,
} from '../hooks/useProjects'
import { useTasks } from '../hooks/useTasks'
import { useI18n } from '../i18n/useI18n'

// One labelled line in the sidebar's details card.
function DetailRow({ icon: Icon, label, children }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-300">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-gray-400 dark:text-gray-400">{label}</p>
        <div className="mt-0.5 text-sm text-gray-800 dark:text-gray-200">{children}</div>
      </div>
    </div>
  )
}

export default function ProjectBoardPage() {
  const { t } = useI18n()
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const { data: project, isLoading: isLoadingProject } = useProject(id)
  const { data: tasks, isLoading: isLoadingTasks } = useTasks(id)
  const deleteProject = useDeleteProject()
  const claimProject = useClaimProject()
  const updateProject = useUpdateProject(id)
  const permissions = usePermissions()

  if (isLoadingProject || isLoadingTasks) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    )
  }

  const taskList = tasks || []
  // Counted from the page's own tasks so every tile moves the moment a task changes,
  // without waiting for the project query to refetch its annotations.
  const doneCount = taskList.filter((task) => task.status === 'done').length
  const overdueCount = taskList.filter(isOverdue).length
  const remainingCount = taskList.length - doneCount
  const closed = project?.status === 'closed'
  // Both are plain YYYY-MM-DD, so a string compare is the date compare.
  // Whether the signed-in person is already on this project, which flips the
  // button between taking the work on and stepping off it.
  const isMine = (project?.assignees || []).some((a) => a.id === user?.id)
  // Claiming is always offered; dropping the work needs the permission, so the
  // button disappears rather than failing when an agent is already on it.
  const canClaimToggle =
    !isMine || !!permissions.allow_agent_unassign_projects
  const overrunsEnd = Boolean(
    project?.last_task_due && project?.end_date && project.last_task_due > project.end_date
  )

  // Closing is reversible, but it hides the project from the default list — so it
  // still asks, and the message says what will actually happen.
  async function handleToggleStatus() {
    // Warn before asking, when we can already tell the server will refuse.
    const openTasks = taskList.filter((task) => task.status !== 'done')
    if (!closed && openTasks.length) {
      const listed = openTasks.slice(0, 5).map((task) => `• ${task.title}`)
      if (openTasks.length > 5) listed.push(`• +${openTasks.length - 5}`)
      window.alert(`${t('projects.cannotCloseOpenTasks')}\n\n${listed.join('\n')}`)
      return
    }
    const message = closed ? t('projects.reopenConfirm') : t('projects.closeConfirm')
    if (!window.confirm(`${message}\n\n"${project.name}"`)) return
    try {
      await updateProject.mutateAsync({ status: closed ? 'open' : 'closed' })
    } catch (err) {
      // The server is the authority — show exactly what it refused with, in case
      // the board's task list was stale.
      const data = err?.response?.data
      window.alert(data ? Object.values(data).flat().join(' ') : t('projects.updateFailed'))
    }
  }

  async function handleDelete() {
    if (!window.confirm(`${t('projects.deleteProjectConfirm1')} "${project.name}" ${t('projects.deleteProjectConfirm2')}`)) return
    await deleteProject.mutateAsync(project.id)
    navigate('/projects')
  }

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs
        items={[
          { label: t('crumb.dashboard'), to: '/dashboard' },
          { label: t('projects.title'), to: '/projects' },
          { label: project?.name || t('projects.projectFallback') },
        ]}
      />

      {/* Hero: identity, status and headline progress in one block. */}
      <Card className="bg-gradient-to-br from-indigo-50/70 to-white dark:from-indigo-500/10 dark:to-transparent">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
              <BoardIcon className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
                  {project?.name}
                </h1>
                <Badge color={closed ? 'gray' : 'green'}>
                  {t(closed ? 'projects.status.closed' : 'projects.status.open')}
                </Badge>
              </div>
              {project?.description && (
                <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-300">
                  {project.description}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Taking work on needs no assignment permission — the object
                permission already stops anyone claiming another agent's project. */}
            {project?.can_edit !== false && canClaimToggle && (
              <Button
                variant="secondary"
                onClick={() => claimProject.mutate(project.id)}
                loading={claimProject.isPending}
              >
                <UserIcon className="h-4 w-4" />
                {t(isMine ? 'projects.unassignMe' : 'projects.assignToMe')}
              </Button>
            )}
            {project?.can_edit !== false && (
              <Button
                variant="secondary"
                onClick={handleToggleStatus}
                loading={updateProject.isPending}
              >
                <CheckCircleIcon className="h-4 w-4" />
                {t(closed ? 'projects.reopenProject' : 'projects.closeProject')}
              </Button>
            )}
            {project?.can_edit !== false && (
              <Button variant="danger" onClick={handleDelete} loading={deleteProject.isPending}>
                <TrashIcon className="h-4 w-4" />
                {t('projects.deleteProject')}
              </Button>
            )}
          </div>
        </div>
        <ProgressBar
          className="mt-4 max-w-xs"
          value={doneCount}
          max={taskList.length}
          label={`${doneCount}/${taskList.length} ${t('projects.tasksDone')}`}
        />
      </Card>

      {/* Sits directly under the progress, where an admin looks after reading it. */}
      <ProjectRemark project={project} isAdmin={isAdmin} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label={t('projects.stat.total')} value={taskList.length} icon={InboxIcon} color="indigo" />
        <StatTile label={t('projects.stat.done')} value={doneCount} icon={CheckCircleIcon} color="green" />
        <StatTile label={t('projects.stat.remaining')} value={remainingCount} icon={ClockIcon} color="blue" />
        <StatTile
          label={t('projects.stat.overdue')}
          value={overdueCount}
          icon={ClockIcon}
          color={overdueCount ? 'red' : 'green'}
        />
      </div>

      {/* Tasks lead; context and the admin note sit alongside on wide screens. */}
      {/* Tasks take three of four columns: they are the work, the sidebar is context. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        <Card className="lg:col-span-3">
          <SectionHeader
            icon={BoardIcon}
            title={t('projects.tasks')}
            // Say why the board is inert rather than leaving it looking broken.
            description={
              project?.can_edit !== false
                ? t('projects.tasksHint')
                : closed
                  ? t('projects.closedLock')
                  : t('projects.watchOnly')
            }
          />
          <TaskList projectId={id} tasks={taskList} canEdit={project?.can_edit !== false} />
        </Card>

        <div className="flex flex-col gap-6">
          <Card className="h-fit">
            <SectionHeader icon={BadgeIcon} title={t('projects.details')} />
            <dl className="flex flex-col divide-y divide-gray-100 dark:divide-white/5">
              <DetailRow icon={UserIcon} label={t('field.customer')}>
                {project?.customer ? (
                  project.customer.full_name
                ) : (
                  <span className="text-gray-400 dark:text-gray-400">{t('projects.noCustomer')}</span>
                )}
              </DetailRow>
              <DetailRow icon={UsersIcon} label={t('projects.assignees')}>
                {project?.assignees?.length ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {project.assignees.map((person) => (
                      <span
                        key={person.id}
                        className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 py-0.5 pe-2 ps-0.5 text-xs text-gray-700 dark:bg-white/10 dark:text-gray-200"
                      >
                        <Avatar name={person.full_name} src={person.avatar} size="sm" className="!h-5 !w-5 !text-[9px]" />
                        {person.full_name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-gray-400 dark:text-gray-400">{t('projects.unassigned')}</span>
                )}
              </DetailRow>
              <DetailRow icon={CalendarIcon} label={t('projects.dateRange')}>
                {project?.start_date || project?.end_date ? (
                  <>
                    {project.start_date ? new Date(project.start_date).toLocaleDateString() : '—'}
                    {' → '}
                    {project.end_date ? new Date(project.end_date).toLocaleDateString() : '—'}
                  </>
                ) : (
                  <span className="text-gray-400 dark:text-gray-400">{t('common.none')}</span>
                )}
              </DetailRow>
              <DetailRow icon={ClockIcon} label={t('projects.lastTaskDue')}>
                {project?.last_task_due ? (
                  <span className={overrunsEnd ? 'font-medium text-red-600 dark:text-red-400' : ''}>
                    {new Date(project.last_task_due).toLocaleDateString()}
                    {/* Worth knowing: the work outlasts the window the project promised. */}
                    {overrunsEnd && ` · ${t('projects.pastEndDate')}`}
                  </span>
                ) : (
                  <span className="text-gray-400 dark:text-gray-400">{t('common.none')}</span>
                )}
              </DetailRow>
              <DetailRow icon={UserIcon} label={t('projects.by')}>
                {project?.created_by?.full_name}
              </DetailRow>
              <DetailRow icon={ClockIcon} label={t('field.createdAt')}>
                {project?.created_at && new Date(project.created_at).toLocaleDateString()}
              </DetailRow>
            </dl>
          </Card>
        </div>
      </div>
    </div>
  )
}
