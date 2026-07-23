import { useNavigate } from 'react-router-dom'
import Card from '../ui/Card'
import { BoardIcon, TrashIcon } from '../ui/icons'
import { useDeleteProject } from '../../hooks/useProjects'
import { useI18n } from '../../i18n/useI18n'

export default function ProjectCard({ project }) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const deleteProject = useDeleteProject()

  function handleDelete(event) {
    event.stopPropagation()
    if (!window.confirm(`${t('projects.deleteProjectConfirm1')} "${project.name}" ${t('projects.deleteProjectConfirm2')}`)) return
    deleteProject.mutate(project.id)
  }

  return (
    <Card
      className="group relative cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-soft-lg"
      onClick={() => navigate(`/projects/${project.id}`)}
    >
      <button
        type="button"
        onClick={handleDelete}
        aria-label={`${t('common.delete')} ${project.name}`}
        className="absolute end-3 top-3 rounded-lg p-1 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-gray-600 dark:hover:bg-red-500/10 dark:hover:text-red-400"
      >
        <TrashIcon className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-3 pe-6">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
          <BoardIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-gray-900 dark:text-gray-100">
            {project.name}
          </h3>
          {project.description ? (
            <p className="mt-0.5 line-clamp-2 text-sm text-gray-500 dark:text-gray-400">
              {project.description}
            </p>
          ) : (
            <p className="mt-0.5 text-sm text-gray-400 dark:text-gray-500">{t('projects.noDescription')}</p>
          )}
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3 text-xs dark:border-white/10">
        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-600 ring-1 ring-inset ring-gray-500/15 dark:bg-white/10 dark:text-gray-300 dark:ring-white/10">
          {project.task_count} {t(project.task_count === 1 ? 'projects.taskCountSingular' : 'projects.taskCountPlural')}
        </span>
        <span className="text-gray-400 dark:text-gray-500">{t('projects.by')} {project.created_by?.full_name}</span>
      </div>
    </Card>
  )
}
