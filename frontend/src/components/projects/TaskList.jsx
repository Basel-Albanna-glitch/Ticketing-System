import { useState } from 'react'
import TaskCard from './TaskCard'
import TaskFormModal from './TaskFormModal'
import TaskTemplates from './TaskTemplates'
import Button from '../ui/Button'
import { PlusIcon } from '../ui/icons'
import { useCreateTask, useReorderTasks } from '../../hooks/useTasks'
import { useI18n } from '../../i18n/useI18n'

export default function TaskList({ projectId, tasks, canEdit = true }) {
  const { t } = useI18n()
  const [editingTask, setEditingTask] = useState(null)
  const [creating, setCreating] = useState(false)
  // Exactly one of these is set during a drag: an existing task being reordered, or
  // a palette title about to become a new task.
  const [draggingId, setDraggingId] = useState(null)
  const [draggingTitle, setDraggingTitle] = useState(null)
  const [dragOverId, setDragOverId] = useState(null)
  const [dropError, setDropError] = useState('')
  const reorder = useReorderTasks(projectId)
  const createTask = useCreateTask(projectId)

  const modalOpen = editingTask !== null || creating

  function closeModal() {
    setEditingTask(null)
    setCreating(false)
  }

  // The server owns the order (Task.position), so the list is rendered as given.
  const ordered = tasks

  function clearDrag() {
    setDraggingId(null)
    setDraggingTitle(null)
    setDragOverId(null)
  }

  // Add a template task, optionally slotting it in at `index` instead of the end.
  async function addTemplate(title, index = null) {
    setDropError('')
    try {
      const created = await createTask.mutateAsync({ project: projectId, title, status: 'todo' })
      // Creation appends, so a mid-list drop needs a follow-up reorder.
      if (index !== null && index < ordered.length) {
        const ids = ordered.map((task) => task.id)
        ids.splice(index, 0, created.id)
        await reorder.mutateAsync(ids)
      }
    } catch {
      setDropError(t('projects.saveTaskFailed'))
    }
  }

  function handleDrop(targetId) {
    const toIndex = ordered.findIndex((task) => task.id === targetId)

    if (draggingTitle) {
      const title = draggingTitle
      clearDrag()
      if (toIndex !== -1) addTemplate(title, toIndex)
      return
    }

    const fromIndex = ordered.findIndex((task) => task.id === draggingId)
    clearDrag()
    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return

    const ids = ordered.map((task) => task.id)
    const [moved] = ids.splice(fromIndex, 1)
    ids.splice(toIndex, 0, moved)
    reorder.mutate(ids)
  }

  // Dropping past the last row appends, which is otherwise impossible to express.
  function handleDropAtEnd() {
    if (draggingTitle) {
      const title = draggingTitle
      clearDrag()
      addTemplate(title)
      return
    }
    const fromIndex = ordered.findIndex((task) => task.id === draggingId)
    clearDrag()
    if (fromIndex === -1 || fromIndex === ordered.length - 1) return
    const ids = ordered.map((task) => task.id)
    const [moved] = ids.splice(fromIndex, 1)
    ids.push(moved)
    reorder.mutate(ids)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500 dark:text-gray-300">
          {ordered.length} {t(ordered.length === 1 ? 'projects.taskCountSingular' : 'projects.taskCountPlural')}
        </span>
        {canEdit && (
          <Button onClick={() => setCreating(true)}>
            <PlusIcon className="h-4 w-4" />
            {t('projects.newTask')}
          </Button>
        )}
      </div>

      {canEdit && (
      <TaskTemplates
        usedTitles={ordered.map((task) => task.title)}
        draggingTitle={draggingTitle}
        onAdd={(title) => addTemplate(title)}
        onDragStart={(title) => setDraggingTitle(title)}
        onDragEnd={clearDrag}
      />
      )}

      {dropError && <p className="text-sm text-red-600 dark:text-red-400">{dropError}</p>}

      {ordered.length === 0 ? (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            handleDropAtEnd()
          }}
          className="rounded-2xl border border-gray-200/60 bg-gray-50/60 p-6 text-center text-sm text-gray-400 dark:border-white/5 dark:bg-white/[0.03] dark:text-gray-500"
        >
          {t('projects.noTasks')}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {ordered.map((task) => (
            <div
              key={task.id}
              onDragOver={(e) => {
                // Without preventDefault the browser refuses the drop outright.
                e.preventDefault()
                if (task.id !== draggingId) setDragOverId(task.id)
              }}
              onDragLeave={() => setDragOverId((current) => (current === task.id ? null : current))}
              onDrop={(e) => {
                e.preventDefault()
                handleDrop(task.id)
              }}
              // A ring on the row being displaced shows where the task will land.
              className={`rounded-xl transition-[box-shadow] ${
                dragOverId === task.id ? 'ring-2 ring-indigo-400/60' : ''
              }`}
            >
              <TaskCard
                task={task}
                onClick={() => setEditingTask(task)}
                draggable={canEdit}
                isDragging={draggingId === task.id}
                onDragStart={() => setDraggingId(task.id)}
                onDragEnd={clearDrag}
              />
            </div>
          ))}
          {/* A drop zone below the last row, shown only while something is in flight. */}
          {(draggingId || draggingTitle) && (
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setDragOverId('end')
              }}
              onDragLeave={() => setDragOverId((current) => (current === 'end' ? null : current))}
              onDrop={(e) => {
                e.preventDefault()
                handleDropAtEnd()
              }}
              className={`rounded-xl border border-dashed py-3 text-center text-xs transition-colors ${
                dragOverId === 'end'
                  ? 'border-indigo-400 bg-indigo-50/70 text-indigo-600 dark:border-indigo-400/50 dark:bg-indigo-500/10 dark:text-indigo-300'
                  : 'border-gray-200 text-gray-400 dark:border-white/10 dark:text-gray-500'
              }`}
            >
              {t('projects.dropAtEnd')}
            </div>
          )}
        </div>
      )}

      <TaskFormModal
        open={modalOpen}
        onClose={closeModal}
        projectId={projectId}
        task={editingTask}
        defaultStatus="todo"
        canEdit={canEdit}
      />
    </div>
  )
}
