import { useEffect, useState } from 'react'
import Button from '../ui/Button'
import Input from '../ui/Input'
import Modal from '../ui/Modal'
import Select from '../ui/Select'
import Textarea from '../ui/Textarea'
import { TrashIcon } from '../ui/icons'
import { useAgents } from '../../hooks/useAgents'
import { useCreateTask, useDeleteTask, useUpdateTask } from '../../hooks/useTasks'
import { useI18n } from '../../i18n/useI18n'

const EMPTY_FORM = {
  title: '',
  description: '',
  priority: 'medium',
  status: 'todo',
  assignee_id: '',
  start_date: '',
  due_date: '',
}

export default function TaskFormModal({ open, onClose, projectId, task, defaultStatus = 'todo' }) {
  const { t } = useI18n()
  const { data: agents } = useAgents()
  const createTask = useCreateTask(projectId)
  const updateTask = useUpdateTask(projectId)
  const deleteTask = useDeleteTask(projectId)
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState('')

  useEffect(() => {
    if (task) {
      setForm({
        title: task.title,
        description: task.description || '',
        priority: task.priority,
        status: task.status,
        assignee_id: task.assignee?.id || '',
        start_date: task.start_date || '',
        due_date: task.due_date || '',
      })
    } else {
      setForm({ ...EMPTY_FORM, status: defaultStatus })
    }
    setError('')
  }, [task, defaultStatus, open])

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    const payload = {
      title: form.title,
      description: form.description,
      priority: form.priority,
      status: form.status,
      assignee_id: form.assignee_id || null,
      start_date: form.start_date || null,
      due_date: form.due_date || null,
    }
    try {
      if (task) {
        await updateTask.mutateAsync({ id: task.id, ...payload })
      } else {
        await createTask.mutateAsync({ project: projectId, ...payload })
      }
      onClose()
    } catch (err) {
      const data = err?.response?.data
      const message = data ? Object.values(data).flat().join(' ') : t('projects.saveTaskFailed')
      setError(message)
    }
  }

  async function handleDelete() {
    if (!window.confirm(`${t('projects.deleteTaskConfirm1')} "${task.title}"${t('projects.deleteTaskConfirm2')}`)) return
    await deleteTask.mutateAsync(task.id)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={task ? t('projects.editTask') : t('projects.newTask')}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label={t('projects.taskTitle')}
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          required
        />
        <Textarea
          label={t('field.description')}
          rows={3}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select label={t('field.status')} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="todo">{t('projects.column.todo')}</option>
            <option value="in_progress">{t('projects.column.in_progress')}</option>
            <option value="in_review">{t('projects.column.in_review')}</option>
            <option value="done">{t('projects.column.done')}</option>
          </Select>
          <Select
            label={t('field.priority')}
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: e.target.value })}
          >
            <option value="low">{t('priority.low')}</option>
            <option value="medium">{t('priority.medium')}</option>
            <option value="high">{t('priority.high')}</option>
            <option value="urgent">{t('priority.urgent')}</option>
          </Select>
        </div>
        <Select
          label={t('projects.assignee')}
          value={form.assignee_id}
          onChange={(e) => setForm({ ...form, assignee_id: e.target.value })}
        >
          <option value="">{t('projects.unassigned')}</option>
          {agents?.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.full_name}
            </option>
          ))}
        </Select>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label={t('projects.fromDate')}
            type="date"
            value={form.start_date}
            onChange={(e) => setForm({ ...form, start_date: e.target.value })}
          />
          <Input
            label={t('projects.toDate')}
            type="date"
            value={form.due_date}
            onChange={(e) => setForm({ ...form, due_date: e.target.value })}
          />
        </div>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex items-center justify-between">
          <Button type="submit" loading={createTask.isPending || updateTask.isPending}>
            {task ? t('projects.saveChanges') : t('projects.createTask')}
          </Button>
          {task && (
            <Button type="button" variant="danger" onClick={handleDelete} loading={deleteTask.isPending}>
              <TrashIcon className="h-4 w-4" />
              {t('common.delete')}
            </Button>
          )}
        </div>
      </form>
    </Modal>
  )
}
