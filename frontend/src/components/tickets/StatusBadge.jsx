import { useI18n } from '../../i18n/useI18n'

// A neutral pill with a colored status dot — deliberately a different design from the
// filled/outlined priority badges so status is never confused with a priority.
const STATUS_DOT = {
  open: 'bg-blue-500',
  assigned: 'bg-indigo-500',
  in_progress: 'bg-amber-500',
  on_hold: 'bg-purple-500',
  resolved: 'bg-green-500',
  closed: 'bg-gray-400',
}

// An `open` ticket reads as "Unassigned" until it has an agent, then "Assigned".
export default function StatusBadge({ status, assigned = false }) {
  const { t } = useI18n()
  const key = status === 'open' && assigned ? 'assigned' : status
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-700 ring-1 ring-inset ring-gray-200 dark:bg-white/5 dark:text-gray-300 dark:ring-white/10">
      <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[key] || 'bg-gray-400'}`} />
      {t(`status.${key}`)}
    </span>
  )
}
