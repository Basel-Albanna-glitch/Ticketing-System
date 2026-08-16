import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import Badge from '../ui/Badge'
import EmptyState from '../ui/EmptyState'
import ProgressBar from '../ui/ProgressBar'
import Spinner from '../ui/Spinner'
import { useCustomerProjects } from '../../hooks/useProjects'
import { useI18n } from '../../i18n/useI18n'

// A customer's projects, gathered under the branch each one is filed against. Projects
// with no branch are collected last rather than dropped, so the list always adds up to
// the customer's full total.
export default function CustomerProjects({ customerId, branches = [] }) {
  const { t } = useI18n()
  const { data: projects, isLoading } = useCustomerProjects(customerId)

  const groups = useMemo(() => {
    const byBranch = new Map()
    for (const branch of branches) byBranch.set(branch.id, { branch, projects: [] })
    const unassigned = []
    for (const project of projects || []) {
      const group = project.branch ? byBranch.get(project.branch.id) : null
      if (group) group.projects.push(project)
      // A branch removed after the fact leaves the project here rather than nowhere.
      else unassigned.push(project)
    }
    // Branches with nothing on them would be noise; the branches table above lists them.
    const filled = [...byBranch.values()].filter((g) => g.projects.length > 0)
    if (unassigned.length) filled.push({ branch: null, projects: unassigned })
    return filled
  }, [projects, branches])

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Spinner />
      </div>
    )
  }

  if (!projects?.length) return <EmptyState title={t('customers.noProjects')} />

  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => (
        <div key={group.branch?.id ?? 'none'}>
          <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-300">
            {group.branch ? group.branch.name : t('projects.noBranch')}
            <span className="rounded-full bg-gray-100 px-1.5 text-[10px] font-medium text-gray-500 dark:bg-white/10 dark:text-gray-300">
              {group.projects.length}
            </span>
          </h4>
          <div className="flex flex-col gap-2">
            {group.projects.map((project) => (
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
                <ProgressBar
                  className="mt-2"
                  value={project.done_task_count || 0}
                  max={project.task_count || 0}
                  label={`${project.done_task_count || 0}/${project.task_count || 0} ${t('projects.tasksDone')}`}
                />
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
