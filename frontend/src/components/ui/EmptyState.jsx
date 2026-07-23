import { useI18n } from '../../i18n/useI18n'

export default function EmptyState({ title, description }) {
  const { t } = useI18n()
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 py-12 text-center dark:border-white/10">
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {title ?? t('ui.emptyState')}
      </p>
      {description && <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">{description}</p>}
    </div>
  )
}
