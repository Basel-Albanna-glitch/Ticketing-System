import PriorityBadge from '../tickets/PriorityBadge'
import { CalendarIcon } from '../ui/icons'
import { useI18n } from '../../i18n/useI18n'

function formatDate(value) {
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// Today as YYYY-MM-DD in the viewer's own timezone. due_date is a plain date, so
// comparing it against a UTC instant would flag tasks a day early or late.
function todayISO() {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

// Past its due date and still not finished. A completed task keeps its dates but
// stops nagging — the work landed, however late.
export function isOverdue(task) {
  return !!task.due_date && task.status !== 'done' && task.due_date < todayISO()
}

function DateRange({ startDate, dueDate, overdue }) {
  if (!startDate && !dueDate) return null

  let label
  if (startDate && dueDate && startDate !== dueDate) {
    label = `${formatDate(startDate)} – ${formatDate(dueDate)}`
  } else {
    label = formatDate(dueDate || startDate)
  }

  return (
    <span
      className={`flex items-center gap-1 text-xs ${
        overdue
          ? 'font-medium text-red-600 dark:text-red-400'
          : 'text-gray-400 dark:text-gray-500'
      }`}
    >
      <CalendarIcon className="h-3.5 w-3.5" />
      {label}
    </span>
  )
}

// Without columns to group them, each row carries its own stage marker.
const STATUS_DOT = {
  todo: 'bg-gray-400 dark:bg-gray-500',
  in_progress: 'bg-blue-500',
  in_review: 'bg-amber-500',
  done: 'bg-emerald-500',
}

export default function TaskCard({
  task,
  onClick,
  draggable = false,
  isDragging = false,
  onDragStart,
  onDragEnd,
}) {
  const { t } = useI18n()
  const overdue = isOverdue(task)

  return (
    <div
      role="button"
      tabIndex={0}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClick()}
      className={`flex w-full flex-col gap-2 rounded-xl border p-3 text-start shadow-soft transition-shadow hover:shadow-soft-lg ${
        draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
      } ${
        overdue
          ? 'border-red-300 bg-red-50/60 dark:border-red-500/40 dark:bg-red-500/10'
          : 'border-gray-200/70 bg-white dark:border-white/10 dark:bg-gray-900/70'
      } ${isDragging ? 'opacity-40' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className={`text-sm font-medium text-gray-900 dark:text-gray-100 ${task.status === 'done' ? 'line-through decoration-gray-300 dark:decoration-gray-600' : ''}`}>
          {task.title}
        </p>
        {overdue && (
          <span className="shrink-0 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700 dark:bg-red-500/20 dark:text-red-300">
            {t('projects.overdue')}
          </span>
        )}
      </div>
      {/* Two lines is enough to tell tasks apart; the modal has the rest. */}
      {task.description && (
        <p className="line-clamp-2 whitespace-pre-wrap text-xs text-gray-500 dark:text-gray-400">
          {task.description}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <span className={`h-2 w-2 rounded-full ${STATUS_DOT[task.status] || STATUS_DOT.todo}`} />
            {t(`projects.column.${task.status}`)}
          </span>
          <PriorityBadge priority={task.priority} />
        </div>
        <DateRange startDate={task.start_date} dueDate={task.due_date} overdue={overdue} />
      </div>
      {task.assignees?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {task.assignees.map((person) => (
            <span
              key={person.id}
              className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-600 ring-1 ring-inset ring-gray-500/10 dark:bg-white/10 dark:text-gray-300 dark:ring-white/10"
            >
              {person.full_name}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
