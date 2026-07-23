import PriorityBadge from '../tickets/PriorityBadge'
import { CalendarIcon } from '../ui/icons'

function formatDate(value) {
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function DateRange({ startDate, dueDate }) {
  if (!startDate && !dueDate) return null

  let label
  if (startDate && dueDate && startDate !== dueDate) {
    label = `${formatDate(startDate)} – ${formatDate(dueDate)}`
  } else {
    label = formatDate(dueDate || startDate)
  }

  return (
    <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
      <CalendarIcon className="h-3.5 w-3.5" />
      {label}
    </span>
  )
}

export default function TaskCard({ task, onClick, onDragStart, onDragEnd, isDragging }) {
  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClick()}
      className={`flex w-full cursor-grab flex-col gap-2 rounded-xl border border-gray-200/70 bg-white p-3 text-start shadow-soft transition-shadow hover:shadow-soft-lg active:cursor-grabbing dark:border-white/10 dark:bg-gray-900/70 ${
        isDragging ? 'opacity-40' : ''
      }`}
    >
      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{task.title}</p>
      <div className="flex items-center justify-between">
        <PriorityBadge priority={task.priority} />
        <DateRange startDate={task.start_date} dueDate={task.due_date} />
      </div>
      {task.assignee && (
        <span className="text-xs text-gray-500 dark:text-gray-400">{task.assignee.full_name}</span>
      )}
    </div>
  )
}
