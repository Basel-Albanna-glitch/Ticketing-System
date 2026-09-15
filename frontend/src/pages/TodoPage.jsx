import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import Avatar from '../components/ui/Avatar'
import Breadcrumbs from '../components/ui/Breadcrumbs'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import EmptyState from '../components/ui/EmptyState'
import SegmentedControl from '../components/ui/SegmentedControl'
import Select from '../components/ui/Select'
import Spinner from '../components/ui/Spinner'
import SectionHeader from '../components/ui/SectionHeader'
import StatTile from '../components/ui/StatTile'
import PriorityBadge from '../components/tickets/PriorityBadge'
import TodoAgenda from '../components/todo/TodoAgenda'
import { formatDuration } from '../components/todo/format'
import {
  BellIcon,
  CalendarIcon,
  CheckCircleIcon,
  ClockIcon,
  GripIcon,
  InboxIcon,
  LayoutDenseIcon,
  LayoutSplitIcon,
  LayoutStackIcon,
  LockIcon,
  PaperClipIcon,
  PencilIcon,
  PlusIcon,
  ReportsIcon,
  TrashIcon,
  UsersIcon,
} from '../components/ui/icons'
import { exportTodos } from '../api/todos'
import { useAuth } from '../auth/useAuth'
import {
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
  inbox: 'todo.inbox',
  today: 'todo.viewToday',
  upcoming: 'todo.viewUpcoming',
  report: 'todo.viewReport',
}

const VIEW_HINT_KEY = {
  inbox: 'todo.subtitle',
  today: 'todo.viewTodayHint',
  upcoming: 'todo.viewUpcomingHint',
  report: 'todo.reportHint',
}

// How the two sections are arranged. Nobody's list looks like anybody else's — a shared
// board that dwarfs a three-item private list wants different space than the reverse —
// so the arrangement is the reader's call, not a fixed choice made here.
//
// `wrapper` is how the pair is laid out; `dense` packs the rows inside them.
const LAYOUTS = {
  split: {
    icon: LayoutSplitIcon,
    labelKey: 'todo.layoutSplit',
    hintKey: 'todo.layoutSplitHint',
    wrapper: 'grid grid-cols-1 items-start gap-6 xl:grid-cols-2',
    dense: false,
  },
  stacked: {
    icon: LayoutStackIcon,
    labelKey: 'todo.layoutStacked',
    hintKey: 'todo.layoutStackedHint',
    wrapper: 'flex flex-col gap-6',
    dense: false,
  },
  dense: {
    icon: LayoutDenseIcon,
    labelKey: 'todo.layoutDense',
    hintKey: 'todo.layoutDenseHint',
    wrapper: 'grid grid-cols-1 items-start gap-6 xl:grid-cols-2',
    dense: true,
  },
}

const LAYOUT_KEY = 'todo_layout'

// Per browser, not per account: this is how one person likes to read the page on one
// screen, and it should not follow a 32" monitor's two columns onto a laptop.
function storedLayout() {
  const stored = localStorage.getItem(LAYOUT_KEY)
  return LAYOUTS[stored] ? stored : 'split'
}

// Bar colours for the priority breakdown. Priority is a status scale, not a set of
// arbitrary categories, so it keeps the same colours it wears as a badge everywhere else
// in the app — and every bar is labelled, so the colour is never carrying the meaning by
// itself. Identity breakdowns (people, folders) stay one hue: their rows come and go, and
// cycling hues through a changing list would repaint the survivors on every filter.
const PRIORITY_BAR = {
  urgent: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-blue-500',
  low: 'bg-gray-400',
}

// A ranked count. Width is relative to the largest row, so the longest bar fills and the
// rest read against it. Text wears ink colours, never the bar's.
function CountBar({ label, value, max, tone = 'bg-indigo-500' }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-32 shrink-0 truncate text-xs text-gray-600 dark:text-gray-300" title={label}>
        {label}
      </div>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
        <div
          // Width is the only inline style: it is data, not design.
          style={{ width: `${max > 0 ? Math.round((value / max) * 100) : 0}%` }}
          className={`h-full rounded-full transition-[width] duration-500 ${tone}`}
        />
      </div>
      <div className="w-6 shrink-0 text-end text-xs font-medium tabular-nums text-gray-700 dark:text-gray-200">
        {value}
      </div>
    </div>
  )
}

function ReportBlock({ title, rows, tone, t, emptyKey }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <div>
      <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-400">
        {title}
      </h3>
      {rows.length === 0 ? (
        <p className="text-xs text-gray-400 dark:text-gray-400">{t(emptyKey)}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((row) => (
            <CountBar
              key={row.key ?? row.label}
              label={row.label}
              value={row.value}
              max={max}
              tone={row.tone || tone}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// Where the list stands, rather than what is on it. Counts only what the viewer is
// allowed to see, so two people can read different totals and both be right.
function TodoReport({ rows, t, onExport, exporting }) {
  const open = rows.filter((i) => !i.done)
  const now = Date.now()
  const endOfToday = new Date()
  endOfToday.setHours(23, 59, 59, 999)
  const endOfWeek = new Date(endOfToday)
  endOfWeek.setDate(endOfWeek.getDate() + 7)

  // Kept disjoint on purpose: an item is either already late or still has today to run.
  // Two headline numbers that double-count the same work are worse than one.
  const overdue = open.filter((i) => i.due_at && new Date(i.due_at).getTime() < now)
  const dueToday = open.filter((i) => {
    if (!i.due_at) return false
    const due = new Date(i.due_at).getTime()
    return due >= now && due <= endOfToday.getTime()
  })
  // Private work is nobody else's to pick up, so it is not "waiting for an owner" —
  // counting it here would report a backlog that does not exist.
  const unassigned = open.filter((i) => !i.is_private && !i.assignees?.length)
  const weekAgo = now - 7 * 864e5
  const doneThisWeek = rows.filter(
    (i) => i.done && i.completed_at && new Date(i.completed_at).getTime() >= weekAgo
  )

  const byPriority = ['urgent', 'high', 'medium', 'low']
    .map((p) => ({
      key: p,
      label: t(`priority.${p}`),
      value: open.filter((i) => i.priority === p).length,
      tone: PRIORITY_BAR[p],
    }))
    // A priority nobody is using is noise, not information.
    .filter((r) => r.value > 0)

  const perPerson = new Map()
  for (const item of open) {
    // A private item cannot be assigned, but somebody is plainly carrying it: its author,
    // who is the only person who can see it. Filing it under "nobody" would understate
    // what that person actually has on.
    const names = item.is_private
      ? [item.created_by?.full_name ?? null]
      : item.assignees?.length
        ? item.assignees.map((a) => a.full_name)
        : [null]
    // A shared item counts once for each person carrying it — the question is how much
    // each of them has on, not how the total divides up.
    for (const name of names) perPerson.set(name, (perPerson.get(name) || 0) + 1)
  }
  const byPerson = [...perPerson.entries()]
    .map(([name, value]) => ({ label: name || t('projects.unassigned'), value }))
    .sort((a, b) => b.value - a.value)

  const perFolder = new Map()
  for (const item of open) {
    const name = item.folder?.name || t('todo.unfiled')
    perFolder.set(name, (perFolder.get(name) || 0) + 1)
  }
  const byFolder = [...perFolder.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)

  // When the open work actually lands. Ordered late → never, and the buckets partition
  // the open list exactly, so the column sums to the open total.
  const dueOn = (i) => (i.due_at ? new Date(i.due_at).getTime() : null)
  const byDue = [
    { key: 'overdue', label: t('todo.dueOverdue'), value: overdue.length, tone: 'bg-red-500' },
    { key: 'today', label: t('todo.dueToday'), value: dueToday.length, tone: 'bg-orange-500' },
    {
      key: 'week',
      label: t('todo.dueThisWeek'),
      value: open.filter((i) => {
        const d = dueOn(i)
        return d !== null && d > endOfToday.getTime() && d <= endOfWeek.getTime()
      }).length,
      tone: 'bg-blue-500',
    },
    {
      key: 'later',
      label: t('todo.dueLater'),
      value: open.filter((i) => {
        const d = dueOn(i)
        return d !== null && d > endOfWeek.getTime()
      }).length,
      tone: 'bg-indigo-400',
    },
    {
      key: 'none',
      label: t('todo.dueNone'),
      value: open.filter((i) => dueOn(i) === null).length,
      tone: 'bg-gray-400',
    },
  ].filter((r) => r.value > 0)

  // Only work with both ends recorded can be timed. Items closed before completed_at
  // existed have no start-to-finish span and would drag the average to nonsense.
  const spans = rows
    .filter((i) => i.done && i.completed_at)
    .map((i) => (new Date(i.completed_at) - new Date(i.created_at)) / 864e5)
  const avgDays = spans.length ? (spans.reduce((a, b) => a + b, 0) / spans.length).toFixed(1) : null
  const oldestOpen = open.length
    ? Math.floor((now - Math.min(...open.map((i) => new Date(i.created_at).getTime()))) / 864e5)
    : null
  // A lone Inbox bar restates the open total; it only informs once folders exist.
  const showFolders = byFolder.length > 1

  return (
    <div className="flex flex-col gap-6">
      {/* The numbers worth acting on, rather than a restatement of the list's size. */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          label={t('todo.statOverdue')}
          value={overdue.length}
          icon={CalendarIcon}
          color={overdue.length ? 'red' : 'green'}
        />
        <StatTile label={t('todo.reportDueToday')} value={dueToday.length} icon={ClockIcon} color="amber" />
        <StatTile
          label={t('todo.reportUnassigned')}
          value={unassigned.length}
          icon={InboxIcon}
          color={unassigned.length ? 'purple' : 'green'}
        />
        <StatTile
          label={t('todo.reportDoneThisWeek')}
          value={doneThisWeek.length}
          icon={CheckCircleIcon}
          color="green"
        />
      </div>

      <Card>
        <SectionHeader
          icon={ReportsIcon}
          title={t('todo.reportTitle')}
          description={t('todo.reportHint')}
          action={
            <Button variant="secondary" onClick={onExport} loading={exporting}>
              {t('todo.exportXlsx')}
            </Button>
          }
        />
        {open.length === 0 ? (
          <EmptyState title={t('todo.reportEmpty')} description={t('todo.reportEmptyHint')} />
        ) : (
          <div className="flex flex-col gap-8">
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
              <ReportBlock
                title={t('todo.reportByPriority')}
                rows={byPriority}
                t={t}
                emptyKey="todo.reportNone"
              />
              <ReportBlock
                title={t('todo.reportByPerson')}
                rows={byPerson}
                t={t}
                emptyKey="todo.reportNone"
              />
            </div>
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
              <ReportBlock
                title={t('todo.reportWhenDue')}
                rows={byDue}
                t={t}
                emptyKey="todo.reportNone"
              />
              {showFolders && (
                <ReportBlock
                  title={t('todo.reportByFolder')}
                  rows={byFolder}
                  t={t}
                  emptyKey="todo.reportNone"
                />
              )}
            </div>

            {/* Two figures that need a sentence rather than a bar: one looks backwards
                at how long finished work took, the other at what has sat longest. */}
            <div className="flex flex-wrap gap-x-8 gap-y-2 border-t border-gray-100 pt-4 text-xs text-gray-500 dark:border-white/10 dark:text-gray-300">
              {avgDays !== null && (
                <span>
                  {t('todo.reportAvgDays')}{' '}
                  <span className="font-medium tabular-nums text-gray-800 dark:text-gray-200">
                    {avgDays}
                  </span>
                </span>
              )}
              {oldestOpen !== null && (
                <span>
                  {t('todo.reportOldestOpen')}{' '}
                  <span className="font-medium tabular-nums text-gray-800 dark:text-gray-200">
                    {oldestOpen}
                  </span>
                </span>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
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
// A to-do is overdue while it is still open past its due time — and stays so once it is
// finished, if it was finished after that time. Ticking a late item off doesn't make it
// on time, so the tag doesn't disappear with the checkbox.
// Higher is more urgent. Sorting by priority puts open work above finished work first, then
// the most urgent at the top; equal priorities keep their manual order (the sort is stable).
const PRIORITY_RANK = { urgent: 4, high: 3, medium: 2, low: 1 }

function byPriority(a, b) {
  if (a.done !== b.done) return a.done ? 1 : -1
  return (PRIORITY_RANK[b.priority] || 0) - (PRIORITY_RANK[a.priority] || 0)
}

function isOverdueItem(item, now = Date.now()) {
  if (!item.due_at) return false
  const due = new Date(item.due_at).getTime()
  if (!item.done) return due < now
  return Boolean(item.completed_at) && new Date(item.completed_at).getTime() > due
}

function TodoRow({ item, drag, t, isOverdue, onToggleDone, onEdit, onDelete, deletingId, rows, dense }) {
  const overdue = isOverdue(item)
  // Reminders still to go out, soonest first (the API orders them).
  const pendingReminders = (item.reminders || []).filter((r) => !r.sent_at)
  return (
    <div
      // A row that takes the drop keeps it: the folder and section around it also accept a
      // to-do being shared, and must not act on the same drop a second time.
      onDragOver={(e) => {
        if (!drag.canDrop(item)) return
        e.preventDefault()
        e.stopPropagation()
        if (item.id !== drag.draggingId) drag.onOver(item.id)
      }}
      onDragLeave={() => drag.onLeave(item.id)}
      onDrop={(e) => {
        if (!drag.canDrop(item)) return
        e.preventDefault()
        e.stopPropagation()
        drag.onDrop(item, rows)
      }}
      className={`group relative flex items-start gap-2.5 rounded-lg ${
        dense ? 'py-1.5' : 'py-2.5'
      } pe-2 ps-1 transition-colors hover:bg-gray-50 dark:hover:bg-white/5 ${
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
        className="mt-0.5 shrink-0 cursor-grab text-gray-300 opacity-0 transition-opacity active:cursor-grabbing group-hover:opacity-100 dark:text-gray-500"
      >
        <GripIcon className="h-4 w-4" />
      </span>
      <button type="button" onClick={() => onEdit(item)} className="min-w-0 flex-1 text-start">
        <span
          className={`text-sm ${
            item.done
              ? 'text-gray-400 line-through dark:text-gray-400'
              : 'font-medium text-gray-900 dark:text-gray-100'
          }`}
        >
          {item.title}
        </span>
        {/* The notes preview is the first thing to go when packing rows in: it is the
            one line that repeats what opening the item would tell you anyway. */}
        {item.notes && !dense && (
          <p className="mt-0.5 line-clamp-1 text-xs text-gray-500 dark:text-gray-300">{item.notes}</p>
        )}
        <div
          className={`${
            dense ? 'mt-0.5' : 'mt-1'
          } flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-gray-400 dark:text-gray-400`}
        >
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
          {/* Said in words as well as by the red accent, so it survives the item being
              ticked off: a to-do finished after its due time was still late. */}
          {overdue && (
            <span className="rounded-full bg-red-50 px-1.5 py-0.5 font-medium text-red-700 ring-1 ring-inset ring-red-600/15 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-400/20">
              {t('todo.overdue')}
            </span>
          )}
          {item.duration_minutes != null && <span>{formatDuration(item.duration_minutes, t)}</span>}
          {item.attachments?.length > 0 && (
            <span className="inline-flex items-center gap-0.5" title={t('todo.attachments')}>
              <PaperClipIcon className="h-3.5 w-3.5" />
              {item.attachments.length}
            </span>
          )}
          {/* The next reminder still to go out, and how many follow it. Sent ones are left
              out: the bell would otherwise claim a reminder is coming that already went. */}
          {!item.done && pendingReminders.length > 0 && (
            <span
              className="inline-flex items-center gap-1"
              title={`${t('todo.reminders')}:\n${pendingReminders
                .map((r) => new Date(r.remind_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }))
                .join('\n')}`}
            >
              <BellIcon className="h-3.5 w-3.5" />
              {new Date(pendingReminders[0].remind_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
              {pendingReminders.length > 1 && ` +${pendingReminders.length - 1}`}
            </span>
          )}
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
            : 'border-gray-200 text-gray-500 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 dark:border-white/10 dark:text-gray-300 dark:hover:border-emerald-500/30 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-300'
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
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-gray-400 opacity-0 transition hover:bg-red-50 hover:text-red-600 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 disabled:opacity-50 group-hover:opacity-100 dark:text-gray-400 dark:hover:bg-red-500/10 dark:hover:text-red-400"
      >
        {deletingId === item.id ? <Spinner /> : <TrashIcon className="h-4 w-4" />}
      </button>
    </div>
  )
}

// A folder as a heading over its rows, not a box around them. `folder` is null for the
// Inbox pile.
function FolderGroup({
  folder,
  isPrivateSection,
  rows,
  collapsed,
  onToggleCollapse,
  onRename,
  onDeleteFolder,
  t,
  rowProps,
}) {
  const { drag } = rowProps
  return (
    <div
      className="group/folder"
      // Dropping a to-do being shared onto the folder — its heading, or around its rows —
      // files it here.
      onDragOver={(e) => {
        if (!drag.canDropInto(isPrivateSection)) return
        e.preventDefault()
        e.stopPropagation()
      }}
      onDrop={(e) => {
        if (!drag.canDropInto(isPrivateSection)) return
        e.preventDefault()
        e.stopPropagation()
        drag.onDropInto(folder?.id ?? null)
      }}
    >
      <div className="flex items-center gap-1.5 border-b border-gray-100 pb-1.5 dark:border-white/10">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex min-w-0 flex-1 items-center gap-1.5 py-1 text-start"
          aria-expanded={!collapsed}
        >
          <span className="w-3 text-[10px] text-gray-400 dark:text-gray-400">
            {collapsed ? '▶' : '▼'}
          </span>
          <span className="truncate text-xs font-bold uppercase tracking-wide text-gray-700 dark:text-gray-200">
            {folder ? folder.name : t('todo.unfiled')}
          </span>
          {/* A count is information, not decoration, so it stays out of the faint tier
              the separators and chevrons sit in. */}
          <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400">{rows.length}</span>
        </button>
        {folder && (
          <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover/folder:opacity-100">
            <button
              type="button"
              onClick={() => onRename(folder)}
              title={t('todo.renameFolder')}
              aria-label={`${t('todo.renameFolder')} ${folder.name}`}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-gray-100"
            >
              <PencilIcon className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onDeleteFolder(folder)}
              title={t('todo.deleteFolder')}
              aria-label={`${t('todo.deleteFolder')} ${folder.name}`}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-gray-400 dark:hover:bg-red-500/10 dark:hover:text-red-400"
            >
              <TrashIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
      {!collapsed &&
        (rows.length === 0 ? (
          <p className="py-3 ps-6 text-xs text-gray-400 dark:text-gray-400">{t('todo.folderEmpty')}</p>
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

// One side of the divide: its folders, then whatever is loose. Reordering stays inside a
// section. The one move across is a private to-do its author drops onto the shared side —
// never the other way, which would quietly hide the team's work from the team.
function TodoSection({
  icon,
  isPrivate = false,
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
  dense,
  t,
  rowProps,
}) {
  const loose = rows.filter((item) => !item.folder)
  // An empty Inbox heading is pure noise when folders are carrying everything; it
  // only earns its place when there is loose work, or when there are no folders at all.
  const showLoose = loose.length > 0 || folders.length === 0
  const { drag } = rowProps
  // While a private to-do its author may share is being dragged, the shared side says it
  // will take it.
  const sharing = !isPrivate && drag.canDropInto(false)
  return (
    <div
      className={`rounded-2xl ${sharing ? 'ring-2 ring-indigo-400/60' : ''}`}
      // Dropped anywhere on the section that isn't a folder or a row, it lands unfiled.
      onDragOver={(e) => {
        if (!drag.canDropInto(isPrivate)) return
        e.preventDefault()
      }}
      onDrop={(e) => {
        if (!drag.canDropInto(isPrivate)) return
        e.preventDefault()
        drag.onDropInto(null)
      }}
    >
      <Card>
        <SectionHeader
          icon={icon}
          title={`${title} (${rows.length})`}
          description={description}
          // Omitted in the Inbox, where a new folder would appear to do nothing: the
          // Inbox shows only what is unfiled, so the folder lands out of sight.
          action={
            onAddFolder ? (
              <Button variant="ghost" onClick={onAddFolder} loading={addingFolder}>
                <PlusIcon className="h-4 w-4" />
                {t('todo.newFolder')}
              </Button>
            ) : null
          }
        />
        {sharing && (
          <p className="mb-3 rounded-lg border border-dashed border-indigo-300 px-3 py-2 text-xs text-indigo-700 dark:border-indigo-400/40 dark:text-indigo-300">
            {t('todo.dropToShare')}
          </p>
        )}
        {rows.length === 0 && folders.length === 0 ? (
          <EmptyState title={emptyTitle} description={emptyHint} />
        ) : (
          <div className={`flex flex-col ${dense ? 'gap-3' : 'gap-5'}`}>
            {folders.map((folder) => (
              <FolderGroup
                key={folder.id}
                folder={folder}
                isPrivateSection={isPrivate}
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
                isPrivateSection={isPrivate}
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
    </div>
  )
}

export default function TodoPage() {
  const { t } = useI18n()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [filter, setFilter] = useState('open')
  // 'manual' is the drag order; 'priority' sorts urgent work to the top of every folder.
  const [sortBy, setSortBy] = useState('manual')
  // The section comes from the URL, so each one is its own address: the sidebar can
  // mark the active one, and a link to "Today" survives being shared or bookmarked.
  const { view: rawView } = useParams()
  const view = VIEW_LABEL_KEY[rawView] ? rawView : 'inbox'
  const isReport = view === 'report'
  // Upcoming is dated work by definition, so it is grouped by day rather than piled
  // into one list: "next Tuesday and the Friday after" is a shape a flat list hides.
  const isAgenda = view === 'upcoming'
  // The two Shared/Private sections, and everything that only makes sense alongside them.
  const isSections = !isReport && !isAgenda
  // 'open' and 'done' are server-side filters; 'all' sends nothing, and so does 'overdue',
  // which spans both (still open past due, or finished late) and is narrowed below. The
  // report needs the whole picture, so it ignores the status filter rather than reporting
  // on a slice.
  const filters =
    isReport || filter === 'all' || filter === 'overdue' ? {} : { done: filter === 'done' }
  const matchesFilter = (item) => filter !== 'overdue' || isOverdueItem(item)
  const { data: todos, isLoading } = useTodos(filters)
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
  const [layout, setLayout] = useState(storedLayout)
  const activeLayout = LAYOUTS[layout]

  const [exporting, setExporting] = useState(false)
  const [draggingId, setDraggingId] = useState(null)
  const [dragOverId, setDragOverId] = useState(null)
  // The row being dragged: which side it came from decides where it may land, and whose it
  // is decides whether it may cross into the shared list.
  const [draggingItem, setDraggingItem] = useState(null)

  // Today reaches back over anything already late — a missed deadline is today's
  // problem, not yesterday's. Undated work belongs to no particular day, so it appears
  // under All only, the way it always has.
  const endOfToday = new Date()
  endOfToday.setHours(23, 59, 59, 999)
  const inView = (item) => {
    // The Inbox is the list itself: folders and all. Only the date views narrow.
    if (view === 'inbox' || isReport) return true
    if (!item.due_at) return false
    return view === 'today'
      ? new Date(item.due_at) <= endOfToday
      : new Date(item.due_at) > endOfToday
  }

  const allRows = todos || []
  const filteredRows = allRows.filter((item) => inView(item) && matchesFilter(item))
  // Sorted once here; folders and sections split this list without reordering it.
  const rows = sortBy === 'priority' ? [...filteredRows].sort(byPriority) : filteredRows
  // The server only ever sends private items belonging to the current user, so splitting
  // on the flag alone is enough — there is no "someone else's private" case to exclude.
  const publicRows = rows.filter((item) => !item.is_private)
  const privateRows = rows.filter((item) => item.is_private)
  const allFolders = folders || []
  // Folders show wherever rows do. The date views keep them so you can still see which
  // folder a dated item belongs to.
  const publicFolders = allFolders.filter((f) => !f.is_private)
  const privateFolders = allFolders.filter((f) => f.is_private)
  const openCount = rows.filter((item) => !item.done).length
  const doneCount = rows.filter((item) => item.done).length
  const now = Date.now()
  const isOverdue = (item) => isOverdueItem(item, now)
  const overdueCount = rows.filter(isOverdue).length

  // Adding and editing both happen on a page of their own. Each carries where it was
  // opened from, so saving returns to the view you left rather than dumping everyone
  // in the Inbox.
  function openCreate() {
    navigate('/todo/new', { state: { from: pathname } })
  }

  function openEdit(item) {
    navigate(`/todo/${item.id}/edit`, { state: { from: pathname } })
  }

  async function handleExport() {
    setExporting(true)
    try {
      const { blob, filename } = await exportTodos()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      // Without this the blob is held for the life of the document.
      URL.revokeObjectURL(url)
    } catch {
      window.alert(t('todo.exportFailed'))
    } finally {
      setExporting(false)
    }
  }

  // Written straight through rather than in an effect: the only way it changes is
  // somebody pressing one of three buttons.
  function changeLayout(next) {
    setLayout(next)
    localStorage.setItem(LAYOUT_KEY, next)
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

  // A private to-do can be dragged into the shared list — only that way round, since pulling
  // shared work into a private list would hide it from the team — and only by its author,
  // the one person allowed to change its privacy (the server holds the same rule). Sharing
  // changes who can see it, so it is confirmed rather than done on release.
  const canShare = (item) => Boolean(item?.is_private) && item.created_by?.id === user?.id

  function moveToShared(item, folderId) {
    if (
      !window.confirm(
        `${t('todo.moveToSharedConfirm')} "${item.title}"?\n\n${t('todo.moveToSharedHint')}`
      )
    )
      return
    updateTodo.mutate(
      { id: item.id, is_private: false, folder_id: folderId ?? null },
      {
        onError: (err) => {
          const data = err?.response?.data
          window.alert(data ? Object.values(data).flat().join(' ') : t('todo.moveToSharedFailed'))
        },
      }
    )
  }

  function endDrag() {
    setDraggingId(null)
    setDragOverId(null)
    setDraggingItem(null)
  }

  // Reordering happens inside one section, over that section's rows only. Positions may
  // collide across the two lists, which is harmless: each is sorted independently.
  const drag = {
    draggingId,
    dragOverId,
    onStart: (item) => {
      setDraggingId(item.id)
      setDraggingItem(item)
    },
    onEnd: endDrag,
    onOver: setDragOverId,
    onLeave: (id) => setDragOverId((current) => (current === id ? null : current)),
    // Within a section any row takes a drop. Across, only a private to-do being shared, onto
    // the shared side; any other crossing would change who can see it without being asked.
    // Reordering only makes sense in manual order: under a priority sort the rows would
    // snap straight back to where the sort puts them.
    canDrop: (item) =>
      !draggingItem ||
      (sortBy === 'manual' && item.is_private === draggingItem.is_private) ||
      (!item.is_private && canShare(draggingItem)),
    // Folders and the shared section itself take a to-do being shared.
    canDropInto: (isPrivateSection) => !isPrivateSection && canShare(draggingItem),
    onDropInto: (folderId) => {
      const item = draggingItem
      endDrag()
      if (item) moveToShared(item, folderId)
    },
    onDrop: (target, sectionRows) => {
      const item = draggingItem
      const from = sectionRows.findIndex((r) => r.id === draggingId)
      const to = sectionRows.findIndex((r) => r.id === target.id)
      endDrag()
      // Dropped on a shared row: it moves across and joins that row's folder.
      if (item && item.is_private !== target.is_private) {
        moveToShared(item, target.folder?.id)
        return
      }
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
    dense: activeLayout.dense,
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Every view is a section now, All included, so the trail is the same shape
          whichever one you are in. */}
      <Breadcrumbs
        items={[
          { label: t('crumb.dashboard'), to: '/dashboard' },
          { label: t('nav.todo'), to: '/todo' },
          { label: t(VIEW_LABEL_KEY[view]) },
        ]}
      />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
            {t(VIEW_LABEL_KEY[view])}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-300">
            {t(VIEW_HINT_KEY[view])}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* The layout switch arranges the two sections, so it only appears where they
              do — not on the report, and not on the calendar, which has a shape of its
              own. The status filter narrows any of them, so it stays. */}
          {isSections && (
            <SegmentedControl
              value={layout}
              onChange={changeLayout}
              iconOnly
              aria-label={t('todo.layout')}
              options={Object.entries(LAYOUTS).map(([key, config]) => ({
                value: key,
                icon: config.icon,
                label: t(config.labelKey),
                // The glyph shows the arrangement; the tooltip says what it is for.
                title: `${t(config.labelKey)} — ${t(config.hintKey)}`,
              }))}
            />
          )}
          {isSections && (
            <Select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-40"
              aria-label={t('todo.sortLabel')}
            >
              <option value="manual">{t('todo.sortManual')}</option>
              <option value="priority">{t('todo.sortPriority')}</option>
            </Select>
          )}
          {!isReport && (
            <Select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-32"
              aria-label={t('field.status')}
            >
              <option value="open">{t('todo.filterOpen')}</option>
              <option value="done">{t('todo.filterDone')}</option>
              <option value="overdue">{t('todo.filterOverdue')}</option>
              <option value="all">{t('common.all')}</option>
            </Select>
          )}
          <Button onClick={openCreate} className="whitespace-nowrap">
            <PlusIcon className="h-4 w-4" />
            {t('todo.newItem')}
          </Button>
        </div>
      </div>

      {/* The report brings its own headline numbers, and a second Overdue tile directly
          above them would only invite a double-take over which one is authoritative. The
          calendar counts a month, while these count the whole open list — two different
          answers to "how much is there", side by side, and no way to tell which is which. */}
      {isSections && (
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
      )}

      {isLoading ? (
        <Card>
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        </Card>
      ) : isAgenda ? (
        // The agenda groups the same rows the sections would have shown, so it needs no
        // query of its own — and no second answer to what is on the list.
        <TodoAgenda rows={allRows.filter(matchesFilter)} />
      ) : isReport ? (
        <TodoReport rows={allRows} t={t} onExport={handleExport} exporting={exporting} />
      ) : (
        // Whichever arrangement was chosen. The two-column ones collapse to one below
        // xl regardless: at half a laptop's width a row's dates, badges and buttons
        // wrap onto four lines each, which is nobody's idea of a layout.
        <div className={activeLayout.wrapper}>
          <TodoSection
            icon={UsersIcon}
            isPrivate={false}
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
            dense={activeLayout.dense}
            t={t}
            rowProps={rowProps}
          />
          <TodoSection
            icon={LockIcon}
            isPrivate
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
            dense={activeLayout.dense}
            t={t}
            rowProps={rowProps}
          />
        </div>
      )}

    </div>
  )
}
