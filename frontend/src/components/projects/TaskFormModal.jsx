import { useEffect, useState } from 'react'
import Button from '../ui/Button'
import Input from '../ui/Input'
import Modal from '../ui/Modal'
import MultiSelect from '../ui/MultiSelect'
import Select from '../ui/Select'
import Stepper from '../ui/Stepper'
import Textarea from '../ui/Textarea'
import { TrashIcon } from '../ui/icons'
import { useAgents } from '../../hooks/useAgents'
import { useAuth } from '../../auth/useAuth'
import { usePermissions } from '../../auth/usePermissions'
import { useCreateTask, useDeleteTask, useUpdateTask } from '../../hooks/useTasks'
import { useI18n } from '../../i18n/useI18n'

// The board's columns, in order. The stepper walks these left to right.
const STATUS_STEPS = ['todo', 'in_progress', 'in_review', 'done']

// Local YYYY-MM-DD, matching how the API compares plain dates.
function todayISO() {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

const EMPTY_FORM = {
  title: '',
  description: '',
  priority: 'medium',
  status: 'todo',
  assignee_ids: [],
  start_date: '',
  due_date: '',
}

export default function TaskFormModal({
  open,
  onClose,
  projectId,
  task,
  defaultStatus = 'todo',
  canEdit = true,
}) {
  const { t } = useI18n()
  const { data: agents } = useAgents({ includeAdmins: true })
  const { user } = useAuth()
  const permissions = usePermissions()
  // Putting yourself on a task never needs permission; the switch only governs
  // involving other people, so the picker always shows and just narrows.
  const canAssignOthers = !!permissions.allow_agent_assign_tasks
  const createTask = useCreateTask(projectId)
  const updateTask = useUpdateTask(projectId)
  const deleteTask = useDeleteTask(projectId)
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState('')
  // A future start date freezes the stage picker until that day arrives. Declared
  // after `form`, which it reads.
  const notStartedYet = !!form.start_date && form.start_date > todayISO()

  useEffect(() => {
    if (task) {
      setForm({
        title: task.title,
        description: task.description || '',
        priority: task.priority,
        status: task.status,
        assignee_ids: (task.assignees || []).map((a) => a.id),
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
    // A title of only digits or punctuation titles nothing — the same rule the
    // ticket subject and project name use. \p{L} keeps it true in any language.
    if (!/\p{L}/u.test(form.title)) {
      setError(t('projects.taskTitleMustContainText'))
      return
    }
    // Mirrors the serializer, so the round trip is not needed to learn it.
    if (form.start_date && form.due_date && form.start_date > form.due_date) {
      setError(t('projects.taskDateOrder'))
      return
    }
    const payload = {
      title: form.title,
      description: form.description,
      priority: form.priority,
      status: form.status,
      // Always sent, so clearing every assignee really does unassign the task.
      assignee_ids: form.assignee_ids,
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
      // Keep the field names: "start_date: ..." says where to look, where the
      // bare message alone left you hunting for which input it meant.
      const detail = err?.response?.data
      const fieldErrors =
        detail && typeof detail === 'object' && !Array.isArray(detail)
          ? Object.entries(detail)
              .map(([field, messages]) => `${field}: ${[].concat(messages).join(' ')}`)
              .join(' · ')
          : ''
      setError(fieldErrors || t('projects.saveTaskFailed'))
    }
  }

  async function handleDelete() {
    if (!window.confirm(`${t('projects.deleteTaskConfirm1')} "${task.title}"${t('projects.deleteTaskConfirm2')}`)) return
    await deleteTask.mutateAsync(task.id)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={canEdit ? (task ? t('projects.editTask') : t('projects.newTask')) : t('projects.viewTask')}
      dismissOnBackdrop={false}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {!canEdit && (
          <p className="rounded-lg bg-gray-100 px-3 py-2 text-xs text-gray-600 dark:bg-white/5 dark:text-gray-300">
            {t('projects.watchOnly')}
          </p>
        )}
        <fieldset disabled={!canEdit} className="flex flex-col gap-4">
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
        <Stepper
          label={t('field.status')}
          value={form.status}
          onChange={(status) => setForm({ ...form, status })}
          steps={STATUS_STEPS.map((s) => ({ value: s, label: t(`projects.column.${s}`) }))}
          // Work cannot progress before the day it is scheduled to begin.
          disabled={notStartedYet}
        />
        {notStartedYet && (
          <p className="-mt-2 text-xs text-amber-700 dark:text-amber-400">
            {t('projects.startsLater')} {new Date(form.start_date).toLocaleDateString()}
          </p>
        )}
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
        <MultiSelect
          label={t('projects.assignees')}
          value={form.assignee_ids}
          onChange={(ids) => setForm({ ...form, assignee_ids: ids })}
          placeholder={t('projects.unassigned')}
          // Without the permission the list is just you: anyone already on the
          // task still shows as a chip, they simply cannot be added or removed.
          options={(agents || [])
            .filter((agent) => canAssignOthers || agent.id === user?.id || form.assignee_ids.includes(agent.id))
            .map((agent) => ({ value: agent.id, label: agent.full_name }))}
        />
        {!canAssignOthers && (
          <p className="-mt-2 text-xs text-gray-500 dark:text-gray-400">
            {t('projects.selfAssignOnly')}
          </p>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label={t('projects.fromDate')}
            type="date"
            value={form.start_date}
            max={form.due_date || undefined}
            onChange={(e) => setForm({ ...form, start_date: e.target.value })}
          />
          <Input
            label={t('projects.toDate')}
            type="date"
            value={form.due_date}
            min={form.start_date || undefined}
            onChange={(e) => setForm({ ...form, due_date: e.target.value })}
          />
        </div>
        </fieldset>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        {canEdit && (
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
        )}
      </form>
    </Modal>
  )
}
