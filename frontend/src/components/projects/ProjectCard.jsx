import { useNavigate } from 'react-router-dom'
import Card from '../ui/Card'
import ProgressBar from '../ui/ProgressBar'
import { BoardIcon, CalendarIcon, PencilIcon, TrashIcon } from '../ui/icons'
import { useDeleteProject } from '../../hooks/useProjects'
import { useI18n } from '../../i18n/useI18n'

export default function ProjectCard({ project, onEdit }) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const deleteProject = useDeleteProject()

  function handleDelete(event) {
    event.stopPropagation()
    if (!window.confirm(`${t('projects.deleteProjectConfirm1')} "${project.name}" ${t('projects.deleteProjectConfirm2')}`)) return
    // A refusal has to be spoken: the button lives on a card with no error area,
    // so without this the click would simply appear to do nothing.
    deleteProject.mutate(project.id, {
      onError: (err) =>
        window.alert(err?.response?.data?.detail || t('projects.deleteFailed')),
    })
  }

  // The card itself navigates to the board, so the action buttons must not bubble.
  function handleEdit(event) {
    event.stopPropagation()
    onEdit(project)
  }

  return (
    <Card
      className="group relative cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-soft-lg"
      onClick={() => navigate(`/projects/${project.id}`)}
    >
      {/* can_edit comes from the API, which owns the rule: admins always, agents
          only for unassigned work or their own. */}
      <div className="absolute end-3 top-3 flex items-center gap-0.5">
        {project.can_edit !== false && (
        <button
          type="button"
          onClick={handleEdit}
          aria-label={`${t('projects.editProject')} ${project.name}`}
          className="rounded-lg p-1 text-gray-300 transition-colors hover:bg-indigo-50 hover:text-indigo-600 dark:text-gray-500 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-400"
        >
          <PencilIcon className="h-4 w-4" />
        </button>
        )}
        {/* can_delete is separate from can_edit: a closed project stays editable
            by an admin but can never be deleted until it is reopened. */}
        {project.can_delete !== false && (
        <button
          type="button"
          onClick={handleDelete}
          aria-label={`${t('common.delete')} ${project.name}`}
          className="rounded-lg p-1 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-gray-500 dark:hover:bg-red-500/10 dark:hover:text-red-400"
        >
          <TrashIcon className="h-4 w-4" />
        </button>
        )}
      </div>
      <div className="flex items-start gap-3 pe-14">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
          <BoardIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-base font-semibold text-gray-900 dark:text-gray-100">
              {project.name}
            </h3>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ring-1 ring-inset ${
                project.status === 'closed'
                  ? 'bg-gray-100 text-gray-600 ring-gray-500/15 dark:bg-white/10 dark:text-gray-300 dark:ring-white/10'
                  : 'bg-emerald-50 text-emerald-700 ring-emerald-600/15 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-400/20'
              }`}
            >
              {t(project.status === 'closed' ? 'projects.status.closed' : 'projects.status.open')}
            </span>
          </div>
          {project.customer && (
            <p className="mt-0.5 truncate text-xs text-indigo-600 dark:text-indigo-400">
              {project.customer.full_name}
            </p>
          )}
          {project.description ? (
            <p className="mt-0.5 line-clamp-2 text-sm text-gray-500 dark:text-gray-300">
              {project.description}
            </p>
          ) : (
            <p className="mt-0.5 text-sm text-gray-400 dark:text-gray-400">{t('projects.noDescription')}</p>
          )}
        </div>
      </div>
      {/* Only ever present for admins — the API withholds it from everyone else. */}
      {project.remark && (
        <p className="mt-3 line-clamp-2 rounded-lg border border-amber-200/70 bg-amber-50/60 px-2 py-1.5 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/5 dark:text-amber-300">
          {project.remark}
        </p>
      )}
      {project.assignees?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {project.assignees.map((person) => (
            <span
              key={person.id}
              className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-600 ring-1 ring-inset ring-gray-500/10 dark:bg-white/10 dark:text-gray-300 dark:ring-white/10"
            >
              {person.full_name}
            </span>
          ))}
        </div>
      )}
      <ProgressBar
        className="mt-4"
        value={project.done_task_count || 0}
        max={project.task_count || 0}
        label={`${project.done_task_count || 0}/${project.task_count || 0} ${t('projects.tasksDone')}`}
      />
      <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3 text-xs dark:border-white/10">
        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-600 ring-1 ring-inset ring-gray-500/15 dark:bg-white/10 dark:text-gray-300 dark:ring-white/10">
          {project.task_count} {t(project.task_count === 1 ? 'projects.taskCountSingular' : 'projects.taskCountPlural')}
        </span>
        {project.last_task_due ? (
          <span className="inline-flex items-center gap-1 text-gray-400 dark:text-gray-400">
            <CalendarIcon className="h-3.5 w-3.5" />
            {new Date(project.last_task_due).toLocaleDateString()}
          </span>
        ) : (
          <span className="text-gray-400 dark:text-gray-400">{t('projects.by')} {project.created_by?.full_name}</span>
        )}
      </div>
    </Card>
  )
}
