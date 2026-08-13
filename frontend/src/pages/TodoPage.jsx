import { useState } from 'react'
import { useParams } from 'react-router-dom'
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
import SectionHeader from '../components/ui/SectionHeader'
import StatTile from '../components/ui/StatTile'
import Textarea from '../components/ui/Textarea'
import Toggle from '../components/ui/Toggle'
import PriorityBadge from '../components/tickets/PriorityBadge'
import {
  CalendarIcon,
  CheckCircleIcon,
  GripIcon,
  InboxIcon,
  LockIcon,
  PencilIcon,
  PlusIcon,
  ReportsIcon,
  TrashIcon,
  UsersIcon,
} from '../components/ui/icons'
import SearchableSelect from '../components/ui/SearchableSelect'
import { useAuth } from '../auth/useAuth'
import { useAgents } from '../hooks/useAgents'
import { useCustomers } from '../hooks/useCustomers'
import {
  useCreateTodo,
  useCreateTodoFolder,
  useDeleteTodo,
  useDeleteTodoFolder,
  useReorderTodos,
  useTodoFolders,
  useTodos,
  useUpdateTodo,
  useUpdateTodoFolder,
} from '../hooks/useTodos'
import { useI18n } from '../i18n/useI18n'

// The sections of the to-do list, keyed by the URL segment that selects them. An
// unknown segment falls through to the whole list rather than erroring.
const VIEW_LABEL_KEY = {
  today: 'todo.viewToday',
  upcoming: 'todo.viewUpcoming',
  all: 'common.all',
  report: 'todo.viewReport',
}

const VIEW_HINT_KEY = {
  today: 'todo.viewTodayHint',
  upcoming: 'todo.viewUpcomingHint',
  all: 'todo.subtitle',
  report: 'todo.reportHint',
}

const EMPTY_FORM = {
  title: '',
  notes: '',
  priority: 'medium',
  // New work is shared by default — the team board is the norm, and a private item is
  // the deliberate exception.
  is_private: false,
  folder_id: '',
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

// A ranked count. One hue throughout: the bar encodes magnitude only, and identity is
// carried by the label beside it — never by colour alone. Width is relative to the
// largest row, so the longest bar fills and the rest read against it.
function CountBar({ label, value, max }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-28 shrink-0 truncate text-xs text-gray-600 dark:text-gray-300">{label}</div>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
        <div
          // Width is the only inline style: it is data, not design.
          style={{ width: `${max > 0 ? Math.round((value / max) * 100) : 0}%` }}
          className="h-full rounded-full bg-indigo-500 transition-[width] duration-500"
        />
      </div>
      <div className="w-8 shrink-0 text-end text-xs font-medium tabular-nums text-gray-700 dark:text-gray-200">
        {value}
      </div>
    </div>
  )
}

// Where the list stands, rather than what is on it. Counts only what the viewer is
// allowed to see, so two people can read different totals and both be right.
function TodoReport({ rows, isOverdue, t }) {
  const open = rows.filter((i) => !i.done)
  const byPriority = ['urgent', 'high', 'medium', 'low'].map((p) => ({
    key: p,
    label: t(`priority.${p}`),
    value: open.filter((i) => i.priority === p).length,
  }))
  const counts = new Map()
  for (const item of open) {
    const people = item.assignees?.length ? item.assignees.map((a) => a.full_name) : [null]
    for (const name of people) counts.set(name, (counts.get(name) || 0) + 1)
  }
  const byPerson = [...counts.entries()]
    .map(([name, value]) => ({ label: name || t('projects.unassigned'), value }))
    .sort((a, b) => b.value - a.value)

  const priorityMax = Math.max(1, ...byPriority.map((r) => r.value))
  const personMax = Math.max(1, ...byPerson.map((r) => r.value))

  return (
    <Card>
      <SectionHeader
        icon={ReportsIcon}
        title={t('todo.reportTitle')}
        description={t('todo.reportHint')}
      />
      {open.length === 0 ? (
        <EmptyState title={t('todo.reportEmpty')} description={t('todo.reportEmptyHint')} />
      ) : (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div>
            <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
              {t('todo.reportByPriority')}
            </h3>
            <div className="flex flex-col gap-2">
              {byPriority.map((row) => (
                <CountBar key={row.key} label={row.label} value={row.value} max={priorityMax} />
              ))}
            </div>
            <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
              {t('todo.reportOverdue')}{' '}
              <span className="font-medium tabular-nums text-gray-800 dark:text-gray-200">
                {rows.filter(isOverdue).length}
              </span>
            </p>
          </div>
          <div>
            <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
              {t('todo.reportByPerson')}
            </h3>
            <div className="flex flex-col gap-2">
              {byPerson.map((row) => (
                <CountBar key={row.label} label={row.label} value={row.value} max={personMax} />
              ))}
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}

// DRF returns {field: [msg]} or {detail: msg}; a folder action has no inline error area,
// so whatever the server objected to has to make it into the alert.
function folderError(err, fallback) {
  const data = err?.response?.data
  if (!data) return fallback
  if (typeof data === 'string') return data
  const parts = Object.values(data).flat()
  return parts.length ? parts.join(' ') : fallback
}

// A to-do as a flat list row rather than a boxed card: the page already nests a section
// inside a card inside a folder, and a fourth border around every line turned the list
// into a stack of containers. Rows are separated by hairlines and lift on hover instead.
//
// Only the grip is draggable. The row body is a button that opens the item, and a region
// that is simultaneously "click to edit" and "drag to move" resolves to neither.
function TodoRow({ item, drag, t, isOverdue, onToggleDone, onEdit, onDelete, deletingId, rows }) {
  const overdue = isOverdue(item)
  return (
    <div
      onDragOver={(e) => {
        if (!drag.canDrop(item)) return
        e.preventDefault()
        if (item.id !== drag.draggingId) drag.onOver(item.id)
      }}
      onDragLeave={() => drag.onLeave(item.id)}
      onDrop={(e) => {
        if (!drag.canDrop(item)) return
        e.preventDefault()
        drag.onDrop(item, rows)
      }}
      className={`group relative flex items-start gap-2.5 rounded-lg py-2.5 pe-2 ps-1 transition-colors hover:bg-gray-50 dark:hover:bg-white/5 ${
        drag.draggingId === item.id ? 'opacity-40' : ''
      } ${drag.dragOverId === item.id ? 'ring-2 ring-inset ring-indigo-400/60' : ''}`}
    >
      {/* Overdue reads as a thin accent, not a red-filled row. On a list where several
          are late, full red panels stop meaning "urgent" and just mean "list". */}
      {overdue && (
        <span
          aria-hidden
          className="absolute inset-y-1.5 start-0 w-0.5 rounded-full bg-red-500/80"
        />
      )}
      <span
        draggable
        onDragStart={() => drag.onStart(item)}
        onDragEnd={drag.onEnd}
        aria-hidden
        className="mt-0.5 shrink-0 cursor-grab text-gray-300 opacity-0 transition-opacity active:cursor-grabbing group-hover:opacity-100 dark:text-gray-600"
      >
        <GripIcon className="h-4 w-4" />
      </span>
      <button type="button" onClick={() => onEdit(item)} className="min-w-0 flex-1 text-start">
        <span
          className={`text-sm ${
            item.done
              ? 'text-gray-400 line-through dark:text-gray-500'
              : 'font-medium text-gray-900 dark:text-gray-100'
          }`}
        >
          {item.title}
        </span>
        {item.notes && (
          <p className="mt-0.5 line-clamp-1 text-xs text-gray-500 dark:text-gray-400">{item.notes}</p>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-gray-400 dark:text-gray-500">
          {item.due_at && (
            <span
              className={`inline-flex items-center gap-1 ${
                overdue ? 'font-medium text-red-600 dark:text-red-400' : ''
              }`}
            >
              <CalendarIcon className="h-3.5 w-3.5" />
              {item.start_at
                ? `${new Date(item.start_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })} → ${new Date(item.due_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}`
                : new Date(item.due_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
            </span>
          )}
          {item.duration_minutes != null && <span>{formatDuration(item.duration_minutes, t)}</span>}
          {item.customer && (
            <span className="truncate text-indigo-600 dark:text-indigo-400">
              {item.customer.full_name}
            </span>
          )}
          {item.assignees?.map((person) => (
            <span key={person.id} className="inline-flex items-center gap-1">
              <Avatar name={person.full_name} src={person.avatar} size="sm" className="!h-4 !w-4 !text-[8px]" />
              {person.full_name}
            </span>
          ))}
        </div>
      </button>
      {/* Priority sits right-aligned so the badges form a column the eye can scan,
          instead of starting at a different x on every row. */}
      <div className="mt-0.5 shrink-0">
        <PriorityBadge priority={item.priority} variant="outline" />
      </div>
      {/* Marking work finished is a decision, so it gets a button that says what it does
          rather than a checkbox you tick in passing. Pressing it again reopens the item,
          which is why it is a toggle rather than two separate controls. */}
      <button
        type="button"
        onClick={() => onToggleDone(item)}
        aria-pressed={item.done}
        title={item.done ? t('todo.reopen') : t('todo.markDone')}
        className={`mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 ${
          item.done
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/20'
            : 'border-gray-200 text-gray-500 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 dark:border-white/10 dark:text-gray-400 dark:hover:border-emerald-500/30 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-300'
        }`}
      >
        <CheckCircleIcon className="h-3.5 w-3.5" />
        {item.done ? t('todo.reopen') : t('todo.markDone')}
      </button>
      <button
        type="button"
        onClick={() => onDelete(item)}
        disabled={deletingId === item.id}
        title={t('common.delete')}
        aria-label={`${t('common.delete')} ${item.title}`}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-gray-400 opacity-0 transition hover:bg-red-50 hover:text-red-600 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 disabled:opacity-50 group-hover:opacity-100 dark:text-gray-500 dark:hover:bg-red-500/10 dark:hover:text-red-400"
      >
        {deletingId === item.id ? <Spinner /> : <TrashIcon className="h-4 w-4" />}
      </button>
    </div>
  )
}

// A folder as a heading over its rows, not a box around them. `folder` is null for the
// Ungrouped pile.
function FolderGroup({ folder, rows, collapsed, onToggleCollapse, onRename, onDeleteFolder, t, rowProps }) {
  return (
    <div className="group/folder">
      <div className="flex items-center gap-1.5 border-b border-gray-100 pb-1.5 dark:border-white/10">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex min-w-0 flex-1 items-center gap-1.5 py-1 text-start"
          aria-expanded={!collapsed}
        >
          <span className="w-3 text-[10px] text-gray-400 dark:text-gray-500">
            {collapsed ? '▶' : '▼'}
          </span>
          <span className="truncate text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {folder ? folder.name : t('todo.ungrouped')}
          </span>
          <span className="text-xs tabular-nums text-gray-400 dark:text-gray-600">{rows.length}</span>
        </button>
        {folder && (
          <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover/folder:opacity-100">
            <button
              type="button"
              onClick={() => onRename(folder)}
              title={t('todo.renameFolder')}
              aria-label={`${t('todo.renameFolder')} ${folder.name}`}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-500 dark:hover:bg-white/10 dark:hover:text-gray-200"
            >
              <PencilIcon className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onDeleteFolder(folder)}
              title={t('todo.deleteFolder')}
              aria-label={`${t('todo.deleteFolder')} ${folder.name}`}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-gray-500 dark:hover:bg-red-500/10 dark:hover:text-red-400"
            >
              <TrashIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
      {!collapsed &&
        (rows.length === 0 ? (
          <p className="py-3 ps-6 text-xs text-gray-400 dark:text-gray-500">{t('todo.folderEmpty')}</p>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-white/5">
            {rows.map((item) => (
              <TodoRow key={item.id} item={item} rows={rows} t={t} {...rowProps} />
            ))}
          </div>
        ))}
    </div>
  )
}

// One side of the divide: its folders, then whatever is loose. Drag reordering is confined
// to a single group — moving a row across would silently change who can see it.
function TodoSection({
  icon,
  title,
  description,
  rows,
  folders,
  emptyTitle,
  emptyHint,
  collapsedIds,
  onToggleCollapse,
  onAddFolder,
  onRename,
  onDeleteFolder,
  addingFolder,
  t,
  rowProps,
}) {
  const loose = rows.filter((item) => !item.folder)
  // An empty Ungrouped heading is pure noise when folders are carrying everything; it
  // only earns its place when there is loose work, or when there are no folders at all.
  const showLoose = loose.length > 0 || folders.length === 0
  return (
    <Card>
      <SectionHeader
        icon={icon}
        title={`${title} (${rows.length})`}
        description={description}
        action={
          <Button variant="ghost" onClick={onAddFolder} loading={addingFolder}>
            <PlusIcon className="h-4 w-4" />
            {t('todo.newFolder')}
          </Button>
        }
      />
      {rows.length === 0 && folders.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyHint} />
      ) : (
        <div className="flex flex-col gap-5">
          {folders.map((folder) => (
            <FolderGroup
              key={folder.id}
              folder={folder}
              rows={rows.filter((item) => item.folder?.id === folder.id)}
              collapsed={collapsedIds.has(folder.id)}
              onToggleCollapse={() => onToggleCollapse(folder.id)}
              onRename={onRename}
              onDeleteFolder={onDeleteFolder}
              t={t}
              rowProps={rowProps}
            />
          ))}
          {showLoose && (
            <FolderGroup
              folder={null}
              rows={loose}
              collapsed={collapsedIds.has(`loose-${title}`)}
              onToggleCollapse={() => onToggleCollapse(`loose-${title}`)}
              t={t}
              rowProps={rowProps}
            />
          )}
        </div>
      )}
    </Card>
  )
}

export default function TodoPage() {
  const { t } = useI18n()
  const { user } = useAuth()
  const [filter, setFilter] = useState('open')
  // The section comes from the URL, so each one is its own address: the sidebar can
  // mark the active one, and a link to "Today" survives being shared or bookmarked.
  const { view: rawView } = useParams()
  const view = VIEW_LABEL_KEY[rawView] ? rawView : 'all'
  const isReport = view === 'report'
  // 'open' and 'done' are server-side filters; 'all' sends nothing. The report needs
  // the whole picture, so it ignores the status filter rather than reporting on a slice.
  const filters = isReport || filter === 'all' ? {} : { done: filter === 'done' }
  const { data: todos, isLoading } = useTodos(filters)
  const { data: agents } = useAgents({ includeAdmins: true })
  const { data: customers } = useCustomers()
  const createTodo = useCreateTodo()
  const updateTodo = useUpdateTodo()
  const deleteTodo = useDeleteTodo()
  // Which row is mid-delete, so only that button shows a spinner rather than
  // every one of them reacting to the shared mutation state.
  const deletingId = deleteTodo.isPending ? deleteTodo.variables : null
  const reorder = useReorderTodos(filters)
  const { data: folders } = useTodoFolders()
  const createFolder = useCreateTodoFolder()
  const updateFolder = useUpdateTodoFolder()
  const deleteFolder = useDeleteTodoFolder()
  const [collapsedIds, setCollapsedIds] = useState(() => new Set())

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  // A new item is always yours; an existing one only if you wrote it.
  const canChangePrivacy = !editing || editing.created_by?.id === user?.id
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState('')
  const [draggingId, setDraggingId] = useState(null)
  const [dragOverId, setDragOverId] = useState(null)
  // Which section the dragged row came from, so a drop can be refused across the divide.
  const [draggingPrivate, setDraggingPrivate] = useState(null)

  // Today reaches back over anything already late — a missed deadline is today's
  // problem, not yesterday's. Undated work belongs to no particular day, so it appears
  // under All only, the way it always has.
  const endOfToday = new Date()
  endOfToday.setHours(23, 59, 59, 999)
  const inView = (item) => {
    if (view === 'all' || isReport) return true
    if (!item.due_at) return false
    return view === 'today'
      ? new Date(item.due_at) <= endOfToday
      : new Date(item.due_at) > endOfToday
  }

  const allRows = todos || []
  const rows = allRows.filter(inView)
  // The server only ever sends private items belonging to the current user, so splitting
  // on the flag alone is enough — there is no "someone else's private" case to exclude.
  const publicRows = rows.filter((item) => !item.is_private)
  const privateRows = rows.filter((item) => item.is_private)
  const allFolders = folders || []
  const publicFolders = allFolders.filter((f) => !f.is_private)
  const privateFolders = allFolders.filter((f) => f.is_private)
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
      is_private: item.is_private,
      folder_id: item.folder?.id ?? '',
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
      folder_id: form.folder_id || null,
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

  function toggleCollapse(key) {
    setCollapsedIds((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function handleAddFolder(isPrivate) {
    const name = window.prompt(t('todo.folderNamePrompt'))
    if (!name || !name.trim()) return
    createFolder.mutate(
      { name: name.trim(), is_private: isPrivate },
      { onError: (err) => window.alert(folderError(err, t('todo.folderSaveFailed'))) }
    )
  }

  function handleRenameFolder(folder) {
    const name = window.prompt(t('todo.folderNamePrompt'), folder.name)
    if (!name || !name.trim() || name.trim() === folder.name) return
    updateFolder.mutate(
      { id: folder.id, name: name.trim() },
      { onError: (err) => window.alert(folderError(err, t('todo.folderSaveFailed'))) }
    )
  }

  function handleDeleteFolder(folder) {
    // Say plainly that the work survives — "delete folder" reads like it takes the
    // to-dos with it, and people hesitate over that.
    if (!window.confirm(`${t('todo.deleteFolderConfirm')} "${folder.name}"?\n\n${t('todo.deleteFolderHint')}`))
      return
    deleteFolder.mutate(folder.id, {
      onError: (err) => window.alert(folderError(err, t('todo.folderDeleteFailed'))),
    })
  }

  function handleDelete(item) {
    if (!window.confirm(`${t('todo.deleteConfirm')} "${item.title}"?`)) return
    // A row has no error area of its own, so a refusal would otherwise look like
    // the click did nothing at all.
    deleteTodo.mutate(item.id, {
      onError: (err) =>
        window.alert(err?.response?.data?.detail || t('todo.deleteFailed')),
    })
  }

  // Reordering happens inside one section, over that section's rows only. Positions may
  // collide across the two lists, which is harmless: each is sorted independently.
  const drag = {
    draggingId,
    dragOverId,
    onStart: (item) => {
      setDraggingId(item.id)
      setDraggingPrivate(item.is_private)
    },
    onEnd: () => {
      setDraggingId(null)
      setDragOverId(null)
      setDraggingPrivate(null)
    },
    onOver: setDragOverId,
    onLeave: (id) => setDragOverId((current) => (current === id ? null : current)),
    // Refuse a drop from the other section — moving a row across would read as
    // "reorder" while actually changing who can see it.
    canDrop: (item) => draggingPrivate === null || item.is_private === draggingPrivate,
    onDrop: (target, sectionRows) => {
      const from = sectionRows.findIndex((r) => r.id === draggingId)
      const to = sectionRows.findIndex((r) => r.id === target.id)
      setDraggingId(null)
      setDragOverId(null)
      setDraggingPrivate(null)
      if (from === -1 || to === -1 || from === to) return
      const ids = sectionRows.map((r) => r.id)
      const [moved] = ids.splice(from, 1)
      ids.splice(to, 0, moved)
      reorder.mutate(ids)
    },
  }

  // Everything a row needs, identical for both sections.
  const rowProps = {
    drag,
    isOverdue,
    onToggleDone: (item) => updateTodo.mutate({ id: item.id, done: !item.done }),
    onEdit: openEdit,
    onDelete: handleDelete,
    deletingId,
  }

  // The folders this item could move into: the side it is on, and — for a private
  // folder — only your own, which is all the server sends anyway.
  const folderOptions = allFolders.filter((f) => f.is_private === form.is_private)

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs
        items={[
          { label: t('crumb.dashboard'), to: '/dashboard' },
          ...(view === 'all'
            ? [{ label: t('nav.todo') }]
            : [{ label: t('nav.todo'), to: '/todo' }, { label: t(VIEW_LABEL_KEY[view]) }]),
        ]}
      />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
            {view === 'all' ? t('nav.todo') : t(VIEW_LABEL_KEY[view])}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t(VIEW_HINT_KEY[view])}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* The report covers open and done alike, so a status filter would only
              contradict it. */}
          {!isReport && (
            <Select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-32"
              aria-label={t('field.status')}
            >
              <option value="open">{t('todo.filterOpen')}</option>
              <option value="done">{t('todo.filterDone')}</option>
              <option value="all">{t('common.all')}</option>
            </Select>
          )}
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

      {isLoading ? (
        <Card>
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        </Card>
      ) : isReport ? (
        <TodoReport rows={allRows} isOverdue={isOverdue} t={t} />
      ) : (
        <>
          <TodoSection
            icon={UsersIcon}
            title={t('todo.sectionPublic')}
            description={t(
              user?.role === 'admin'
                ? 'todo.sectionPublicHintAdmin'
                : 'todo.sectionPublicHintAgent'
            )}
            rows={publicRows}
            folders={publicFolders}
            emptyTitle={t('todo.empty')}
            emptyHint={t('todo.emptyHint')}
            collapsedIds={collapsedIds}
            onToggleCollapse={toggleCollapse}
            onAddFolder={() => handleAddFolder(false)}
            onRename={handleRenameFolder}
            onDeleteFolder={handleDeleteFolder}
            addingFolder={createFolder.isPending}
            t={t}
            rowProps={rowProps}
          />
          <TodoSection
            icon={LockIcon}
            title={t('todo.sectionPrivate')}
            description={t('todo.sectionPrivateHint')}
            rows={privateRows}
            folders={privateFolders}
            emptyTitle={t('todo.privateEmpty')}
            emptyHint={t('todo.privateEmptyHint')}
            collapsedIds={collapsedIds}
            onToggleCollapse={toggleCollapse}
            onAddFolder={() => handleAddFolder(true)}
            onRename={handleRenameFolder}
            onDeleteFolder={handleDeleteFolder}
            addingFolder={createFolder.isPending}
            t={t}
            rowProps={rowProps}
          />
        </>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={t(editing ? 'todo.editItem' : 'todo.newItem')}
        dismissOnBackdrop={false}
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
          <Select
            label={t('todo.folder')}
            value={form.folder_id}
            onChange={(e) => setForm({ ...form, folder_id: e.target.value })}
          >
            <option value="">{t('todo.ungrouped')}</option>
            {folderOptions.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>
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
          <div>
            <MultiSelect
              label={t('projects.assignees')}
              value={form.assignee_ids}
              onChange={(ids) => setForm({ ...form, assignee_ids: ids })}
              placeholder={t('projects.unassigned')}
              options={(agents || []).map((a) => ({ value: a.id, label: a.full_name }))}
            />
            {/* Assigning is not just a label — it decides who still sees the item. */}
            {!form.is_private && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {form.assignee_ids.length
                  ? t('todo.assignNarrowsHint')
                  : t('todo.unassignedHint')}
              </p>
            )}
          </div>
          {/* Only the author may move an item between the two lists, so this is read-only
              on someone else's — the server refuses it either way. */}
          <div className="flex items-start justify-between gap-4 rounded-xl border border-gray-200/70 p-3 dark:border-white/10">
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                {t('todo.makePrivate')}
              </p>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                {canChangePrivacy ? t('todo.makePrivateHint') : t('todo.privacyOwnerOnly')}
              </p>
            </div>
            <Toggle
              checked={form.is_private}
              disabled={!canChangePrivacy}
              // Folders belong to one side, so a folder chosen before the flip is no
              // longer a legal home — drop back to Ungrouped rather than send a
              // mismatch the server would reject.
              onChange={(value) => setForm({ ...form, is_private: value, folder_id: '' })}
              aria-label={t('todo.makePrivate')}
            />
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <Button type="submit" loading={createTodo.isPending || updateTodo.isPending}>
            {t(editing ? 'projects.saveChanges' : 'todo.addItem')}
          </Button>
        </form>
      </Modal>
    </div>
  )
}
