import { useI18n } from '../../i18n/useI18n'

export default function ActivityTimeline({ activities }) {
  const { t } = useI18n()
  if (!activities?.length) {
    return <p className="text-sm text-gray-400 dark:text-gray-500">{t('tickets.noActivity')}</p>
  }

  return (
    <ul className="flex flex-col">
      {activities.map((a, i) => (
        <li key={a.id} className="relative flex gap-3 pb-4 last:pb-0">
          {i < activities.length - 1 && (
            <span className="absolute start-[5px] top-3 h-full w-px bg-gray-200 dark:bg-white/10" />
          )}
          <span className="relative mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-indigo-500 ring-4 ring-indigo-500/10" />
          <div className="min-w-0 flex-1 text-sm">
            <p className="text-gray-700 dark:text-gray-300">{a.description}</p>
            <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
              {a.actor?.full_name || t('tickets.system')} · {new Date(a.created_at).toLocaleString()}
            </p>
          </div>
        </li>
      ))}
    </ul>
  )
}
