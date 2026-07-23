import { useState } from 'react'
import TaskCard from './TaskCard'
import TaskFormModal from './TaskFormModal'
import { PlusIcon } from '../ui/icons'
import { useUpdateTask } from '../../hooks/useTasks'
import { useI18n } from '../../i18n/useI18n'

const COLUMNS = [
  { status: 'todo', label: 'projects.column.todo', dot: 'bg-gray-400 dark:bg-gray-500' },
  { status: 'in_progress', label: 'projects.column.in_progress', dot: 'bg-blue-500' },
  { status: 'in_review', label: 'projects.column.in_review', dot: 'bg-amber-500' },
  { status: 'done', label: 'projects.column.done', dot: 'bg-emerald-500' },
]

export default function TaskBoard({ projectId, tasks }) {
  const { t } = useI18n()
  const [editingTask, setEditingTask] = useState(null)
  const [creatingStatus, setCreatingStatus] = useState(null)
  const [draggingTaskId, setDraggingTaskId] = useState(null)
  const [dragOverStatus, setDragOverStatus] = useState(null)
  const updateTask = useUpdateTask(projectId)

  const modalOpen = editingTask !== null || creatingStatus !== null

  function closeModal() {
    setEditingTask(null)
    setCreatingStatus(null)
  }

  function handleDragStart(task) {
    setDraggingTaskId(task.id)
  }

  function handleDragEnd() {
    setDraggingTaskId(null)
    setDragOverStatus(null)
  }

  function handleDrop(status) {
    const task = tasks.find((t) => t.id === draggingTaskId)
    if (task && task.status !== status) {
      updateTask.mutate({ id: task.id, status })
    }
    setDraggingTaskId(null)
    setDragOverStatus(null)
  }

  return (
    <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:pb-0">
      {COLUMNS.map((column) => {
        const columnTasks = tasks.filter((t) => t.status === column.status)
        const isDragOver = dragOverStatus === column.status
        return (
          <div
            key={column.status}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOverStatus(column.status)
            }}
            onDragLeave={() => setDragOverStatus((current) => (current === column.status ? null : current))}
            onDrop={(e) => {
              e.preventDefault()
              handleDrop(column.status)
            }}
            className={`flex w-72 shrink-0 flex-col gap-3 rounded-2xl border p-3 transition-colors lg:w-auto ${
              isDragOver
                ? 'border-indigo-300 bg-indigo-50/70 ring-2 ring-inset ring-indigo-400/40 dark:border-indigo-400/30 dark:bg-indigo-500/10'
                : 'border-gray-200/60 bg-gray-50/60 dark:border-white/5 dark:bg-white/[0.03]'
            }`}
          >
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                <span className={`h-2 w-2 rounded-full ${column.dot}`} />
                {t(column.label)}
                <span className="rounded-full bg-gray-200/70 px-1.5 text-xs font-medium text-gray-500 dark:bg-white/10 dark:text-gray-400">
                  {columnTasks.length}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => setCreatingStatus(column.status)}
                className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-200/70 hover:text-indigo-600 dark:text-gray-500 dark:hover:bg-white/10 dark:hover:text-indigo-400"
                aria-label={`${t('projects.addTaskTo')} ${t(column.label)}`}
              >
                <PlusIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="flex min-h-[2rem] flex-col gap-2">
              {columnTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onClick={() => setEditingTask(task)}
                  onDragStart={() => handleDragStart(task)}
                  onDragEnd={handleDragEnd}
                  isDragging={draggingTaskId === task.id}
                />
              ))}
              {columnTasks.length === 0 && (
                <p className="text-xs text-gray-400 dark:text-gray-600">{t('projects.noTasks')}</p>
              )}
            </div>
          </div>
        )
      })}

      <TaskFormModal
        open={modalOpen}
        onClose={closeModal}
        projectId={projectId}
        task={editingTask}
        defaultStatus={creatingStatus || 'todo'}
      />
    </div>
  )
}
