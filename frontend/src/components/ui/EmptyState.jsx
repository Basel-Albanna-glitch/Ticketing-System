import { useI18n } from '../../i18n/useI18n'

// `action` is an optional way out of the empty state — a button or link to clear a filter,
// create the first record, and so on.
export default function EmptyState({ title, description, action }) {
  const { t } = useI18n()
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 py-12 text-center dark:border-white/10">
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {title ?? t('ui.emptyState')}
      </p>
      {description && <p className="mt-1 text-sm text-gray-400 dark:text-gray-400">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}
