import { useState } from 'react'
import Avatar from '../components/ui/Avatar'
import Breadcrumbs from '../components/ui/Breadcrumbs'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import EmptyState from '../components/ui/EmptyState'
import Input from '../components/ui/Input'
import Modal from '../components/ui/Modal'
import MultiSelect from '../components/ui/MultiSelect'
import Select from '../components/ui/Select'
import Spinner from '../components/ui/Spinner'
import StatTile from '../components/ui/StatTile'
import Textarea from '../components/ui/Textarea'
import PriorityBadge from '../components/tickets/PriorityBadge'
import { CalendarIcon, CheckCircleIcon, InboxIcon, PlusIcon, TrashIcon } from '../components/ui/icons'
import SearchableSelect from '../components/ui/SearchableSelect'
import { useAgents } from '../hooks/useAgents'
import { useCustomers } from '../hooks/useCustomers'
import { useCreateTodo, useDeleteTodo, useReorderTodos, useTodos, useUpdateTodo } from '../hooks/useTodos'
import { useI18n } from '../i18n/useI18n'

const EMPTY_FORM = {
  title: '',
  notes: '',
  priority: 'medium',
  start_at: '',
  due_at: '',
  customer_id: '',
  assignee_ids: [],
}

// <input type="datetime-local"> speaks 'YYYY-MM-DDTHH:mm' in local time, while the API
// speaks ISO with an offset. These two convert between them without a UTC round trip.
function toLocalInput(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

function fromLocalInput(value) {
  return value ? new Date(value).toISOString() : null
}

// 330 -> "5h 30m"; 90 -> "1h 30m"; 45 -> "45m"
function formatDuration(minutes, t) {
  if (minutes == null) return null
  const abs = Math.max(0, minutes)
  const days = Math.floor(abs / 1440)
  const hours = Math.floor((abs % 1440) / 60)
  const mins = abs % 60
  const parts = []
  if (days) parts.push(`${days}${t('todo.dayShort')}`)
  if (hours) parts.push(`${hours}${t('todo.hourShort')}`)
  if (mins || !parts.length) parts.push(`${mins}${t('todo.minuteShort')}`)
  return parts.join(' ')
}

export default function TodoPage() {
  const { t } = useI18n()
  const [filter, setFilter] = useState('open')
  // 'open' and 'done' are server-side filters; 'all' sends nothing.
  const filters = filter === 'all' ? {} : { done: filter === 'done' }
  const { data: todos, isLoading } = useTodos(filters)
  const { data: agents } = useAgents({ includeAdmins: true })
  const { data: customers } = useCustomers()
  const createTodo = useCreateTodo()
  const updateTodo = useUpdateTodo()
  const deleteTodo = useDeleteTodo()
  const reorder = useReorderTodos(filters)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState('')
  const [draggingId, setDraggingId] = useState(null)
  const [dragOverId, setDragOverId] = useState(null)

  const rows = todos || []
  const openCount = rows.filter((item) => !item.done).length
  const doneCount = rows.filter((item) => item.done).length
  const now = Date.now()
  const isOverdue = (item) => !item.done && item.due_at && new Date(item.due_at).getTime() < now
  const overdueCount = rows.filter(isOverdue).length

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setError('')
    setModalOpen(true)
  }

  function openEdit(item) {
    setEditing(item)
    setForm({
      title: item.title,
      notes: item.notes || '',
      priority: item.priority,
      start_at: toLocalInput(item.start_at),
      due_at: toLocalInput(item.due_at),
      customer_id: item.customer?.id ?? '',
      assignee_ids: (item.assignees || []).map((a) => a.id),
    })
    setError('')
    setModalOpen(true)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    // Every extra field is optional: empty means null, not an empty string.
    const payload = {
      ...form,
      start_at: fromLocalInput(form.start_at),
      due_at: fromLocalInput(form.due_at),
      customer_id: form.customer_id || null,
    }
    try {
      if (editing) await updateTodo.mutateAsync({ id: editing.id, ...payload })
      else await createTodo.mutateAsync(payload)
      setModalOpen(false)
      setEditing(null)
      setForm(EMPTY_FORM)
    } catch (err) {
      const data = err?.response?.data
      setError(data ? Object.values(data).flat().join(' ') : t('todo.saveFailed'))
    }
  }

  function handleDelete(item) {
    if (!window.confirm(`${t('todo.deleteConfirm')} "${item.title}"?`)) return
    deleteTodo.mutate(item.id)
  }

  function handleDrop(targetId) {
    const from = rows.findIndex((r) => r.id === draggingId)
    const to = rows.findIndex((r) => r.id === targetId)
    setDraggingId(null)
    setDragOverId(null)
    if (from === -1 || to === -1 || from === to) return
    const ids = rows.map((r) => r.id)
    const [moved] = ids.splice(from, 1)
    ids.splice(to, 0, moved)
    reorder.mutate(ids)
  }

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={[{ label: t('crumb.dashboard'), to: '/dashboard' }, { label: t('nav.todo') }]} />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
            {t('nav.todo')}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('todo.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={filter} onChange={(e) => setFilter(e.target.value)} className="w-36" aria-label={t('field.status')}>
            <option value="open">{t('todo.filterOpen')}</option>
            <option value="done">{t('todo.filterDone')}</option>
            <option value="all">{t('common.all')}</option>
          </Select>
          <Button onClick={openCreate} className="whitespace-nowrap">
            <PlusIcon className="h-4 w-4" />
            {t('todo.newItem')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label={t('todo.statOpen')} value={openCount} icon={InboxIcon} color="indigo" />
        <StatTile label={t('todo.statDone')} value={doneCount} icon={CheckCircleIcon} color="green" />
        <StatTile
          label={t('todo.statOverdue')}
          value={overdueCount}
          icon={CalendarIcon}
          color={overdueCount ? 'red' : 'green'}
        />
      </div>

      <Card>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState title={t('todo.empty')} description={t('todo.emptyHint')} />
        ) : (
          <div className="flex flex-col gap-2">
            {rows.map((item) => {
              const overdue = isOverdue(item)
              return (
                <div
                  key={item.id}
                  draggable
                  onDragStart={() => setDraggingId(item.id)}
                  onDragEnd={() => {
                    setDraggingId(null)
                    setDragOverId(null)
                  }}
                  onDragOver={(e) => {
                    e.preventDefault()
                    if (item.id !== draggingId) setDragOverId(item.id)
                  }}
                  onDragLeave={() => setDragOverId((c) => (c === item.id ? null : c))}
                  onDrop={(e) => {
                    e.preventDefault()
                    handleDrop(item.id)
                  }}
                  className={`flex cursor-grab items-start gap-3 rounded-xl border p-3 transition-colors active:cursor-grabbing ${
                    overdue
                      ? 'border-red-300 bg-red-50/60 dark:border-red-500/40 dark:bg-red-500/10'
                      : 'border-gray-200/70 bg-white dark:border-white/10 dark:bg-gray-900/70'
                  } ${draggingId === item.id ? 'opacity-40' : ''} ${
                    dragOverId === item.id ? 'ring-2 ring-indigo-400/60' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={item.done}
                    onChange={() => updateTodo.mutate({ id: item.id, done: !item.done })}
                    aria-label={item.title}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-indigo-600"
                  />
                  <button type="button" onClick={() => openEdit(item)} className="min-w-0 flex-1 text-start">
                    <span
                      className={`text-sm font-medium ${
                        item.done
                          ? 'text-gray-400 line-through dark:text-gray-500'
                          : 'text-gray-900 dark:text-gray-100'
                      }`}
                    >
                      {item.title}
                    </span>
                    {item.notes && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">{item.notes}</p>
                    )}
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <PriorityBadge priority={item.priority} />
                      {item.due_at && (
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] ${
                            overdue
                              ? 'font-medium text-red-600 dark:text-red-400'
                              : 'text-gray-400 dark:text-gray-500'
                          }`}
                        >
                          <CalendarIcon className="h-3.5 w-3.5" />
                          {item.start_at
                            ? `${new Date(item.start_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })} → ${new Date(item.due_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}`
                            : new Date(item.due_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                      )}
                      {item.duration_minutes != null && (
                        <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-500 dark:bg-white/10 dark:text-gray-400">
                          {formatDuration(item.duration_minutes, t)}
                        </span>
                      )}
                      {item.customer && (
                        <span className="truncate text-[11px] text-indigo-600 dark:text-indigo-400">
                          {item.customer.full_name}
                        </span>
                      )}
                      {item.assignees?.map((person) => (
                        <span
                          key={person.id}
                          className="inline-flex items-center gap-1 rounded-full bg-gray-100 py-0.5 pe-2 ps-0.5 text-[11px] text-gray-600 dark:bg-white/10 dark:text-gray-300"
                        >
                          <Avatar name={person.full_name} src={person.avatar} size="sm" className="!h-4 !w-4 !text-[8px]" />
                          {person.full_name}
                        </span>
                      ))}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(item)}
                    aria-label={`${t('common.delete')} ${item.title}`}
                    className="shrink-0 rounded-lg p-1 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-gray-600 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={t(editing ? 'todo.editItem' : 'todo.newItem')}
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label={t('projects.taskTitle')}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
          <Textarea
            label={t('todo.notes')}
            rows={3}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            <Input
              label={t('projects.fromDate')}
              type="datetime-local"
              value={form.start_at}
              onChange={(e) => setForm({ ...form, start_at: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label={t('projects.toDate')}
              type="datetime-local"
              value={form.due_at}
              onChange={(e) => setForm({ ...form, due_at: e.target.value })}
            />
            {/* Read-only: it follows the dates rather than being typed. */}
            <Input
              label={t('todo.duration')}
              value={
                form.start_at && form.due_at
                  ? formatDuration(
                      Math.round((new Date(form.due_at) - new Date(form.start_at)) / 60000),
                      t
                    )
                  : t('common.none')
              }
              readOnly
              disabled
            />
          </div>
          <SearchableSelect
            label={`${t('field.customer')} (${t('common.optional')})`}
            value={form.customer_id}
            onChange={(value) => setForm({ ...form, customer_id: value })}
            placeholder={t('todo.noCustomer')}
            options={[
              { value: '', label: t('todo.noCustomer') },
              ...(customers || []).map((c) => ({
                value: c.id,
                label: `${c.full_name} (${c.username})`,
              })),
            ]}
          />
          <MultiSelect
            label={t('projects.assignees')}
            value={form.assignee_ids}
            onChange={(ids) => setForm({ ...form, assignee_ids: ids })}
            placeholder={t('projects.unassigned')}
            options={(agents || []).map((a) => ({ value: a.id, label: a.full_name }))}
          />
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <Button type="submit" loading={createTodo.isPending || updateTodo.isPending}>
            {t(editing ? 'projects.saveChanges' : 'todo.addItem')}
          </Button>
        </form>
      </Modal>
    </div>
  )
}
