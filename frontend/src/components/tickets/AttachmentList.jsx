import { PaperClipIcon } from '../ui/icons'
import { useI18n } from '../../i18n/useI18n'

export default function AttachmentList({ attachments }) {
  const { t } = useI18n()
  if (!attachments?.length) {
    return <p className="text-sm text-gray-400 dark:text-gray-500">{t('tickets.noAttachments')}</p>
  }

  return (
    <ul className="flex flex-wrap gap-2">
      {attachments.map((a) => (
        <li key={a.id}>
          <a
            href={a.file}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200/70 bg-white px-2.5 py-1.5 text-sm text-gray-700 transition-colors hover:border-indigo-300 hover:text-indigo-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:border-indigo-400/40 dark:hover:text-indigo-300"
          >
            <PaperClipIcon className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500" />
            {a.original_filename}
          </a>
        </li>
      ))}
    </ul>
  )
}
