import { PlusIcon } from '../ui/icons'
import { useI18n } from '../../i18n/useI18n'

// The standard steps a project runs through. These become ordinary tasks the moment
// one is used, so they are titles rather than records — edit this list to change the
// palette. Kept verbatim as supplied.
export const DEFAULT_TASKS = [
  'Kick of meeting',
  'Collect Data sheet',
  'Configration',
  'Create Server',
  'Training',
  'Rest Data',
  'Implentation',
]

// A palette of ready-made task titles. Drag one into the list to insert it at that
// spot, or click it to append — clicking matters because dragging is mouse-only.
export default function TaskTemplates({ usedTitles = [], onAdd, onDragStart, onDragEnd, draggingTitle }) {
  const { t } = useI18n()
  const used = new Set(usedTitles.map((title) => title.trim().toLowerCase()))

  return (
    <div className="rounded-xl border border-dashed border-indigo-200 bg-indigo-50/40 p-3 dark:border-indigo-400/20 dark:bg-indigo-500/5">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
          {t('projects.defaultTasks')}
        </h3>
        <span className="text-[11px] text-indigo-600/70 dark:text-indigo-400/70">
          {t('projects.defaultTasksHint')}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {DEFAULT_TASKS.map((title) => {
          const alreadyAdded = used.has(title.toLowerCase())
          return (
            <button
              key={title}
              type="button"
              draggable={!alreadyAdded}
              onDragStart={() => onDragStart(title)}
              onDragEnd={onDragEnd}
              onClick={() => !alreadyAdded && onAdd(title)}
              disabled={alreadyAdded}
              // Titles already on the board are dimmed rather than hidden, so the
              // palette stays a stable checklist of the standard steps.
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                alreadyAdded
                  ? 'cursor-default border-gray-200 bg-gray-100 text-gray-400 line-through dark:border-white/10 dark:bg-white/5 dark:text-gray-600'
                  : 'cursor-grab border-indigo-200 bg-white text-indigo-700 hover:border-indigo-400 hover:bg-indigo-50 active:cursor-grabbing dark:border-indigo-400/30 dark:bg-gray-900/60 dark:text-indigo-300 dark:hover:bg-indigo-500/10'
              } ${draggingTitle === title ? 'opacity-40' : ''}`}
            >
              {!alreadyAdded && <PlusIcon className="h-3 w-3" />}
              {title}
            </button>
          )
        })}
      </div>
    </div>
  )
}
