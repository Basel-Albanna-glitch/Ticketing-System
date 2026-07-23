import { useNavigate, useParams } from 'react-router-dom'
import Breadcrumbs from '../components/ui/Breadcrumbs'
import Button from '../components/ui/Button'
import Spinner from '../components/ui/Spinner'
import { TrashIcon } from '../components/ui/icons'
import TaskBoard from '../components/projects/TaskBoard'
import { useDeleteProject, useProject } from '../hooks/useProjects'
import { useTasks } from '../hooks/useTasks'
import { useI18n } from '../i18n/useI18n'

export default function ProjectBoardPage() {
  const { t } = useI18n()
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: project, isLoading: isLoadingProject } = useProject(id)
  const { data: tasks, isLoading: isLoadingTasks } = useTasks(id)
  const deleteProject = useDeleteProject()

  if (isLoadingProject || isLoadingTasks) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    )
  }

  async function handleDelete() {
    if (!window.confirm(`${t('projects.deleteProjectConfirm1')} "${project.name}" ${t('projects.deleteProjectConfirm2')}`)) return
    await deleteProject.mutateAsync(project.id)
    navigate('/projects')
  }

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: t('crumb.dashboard'), to: '/dashboard' },
          { label: t('projects.title'), to: '/projects' },
          { label: project?.name || t('projects.projectFallback') },
        ]}
      />
      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{project?.name}</h1>
          {project?.description && (
            <p className="mt-1 text-gray-500 dark:text-gray-400">{project.description}</p>
          )}
        </div>
        <Button variant="danger" onClick={handleDelete} loading={deleteProject.isPending}>
          <TrashIcon className="h-4 w-4" />
          {t('projects.deleteProject')}
        </Button>
      </div>
      <div className="mt-6">
        <TaskBoard projectId={id} tasks={tasks || []} />
      </div>
    </div>
  )
}
