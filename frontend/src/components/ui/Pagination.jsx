import Button from './Button'
import { useI18n } from '../../i18n/useI18n'

export default function Pagination({ page, hasNext, hasPrevious, onPageChange, count }) {
  const { t } = useI18n()
  return (
    <div className="flex items-center justify-between px-1 py-3 text-sm text-gray-500 dark:text-gray-300">
      <span>
        {count} {t('ui.total')}
      </span>
      <div className="flex gap-2">
        <Button variant="secondary" disabled={!hasPrevious} onClick={() => onPageChange(page - 1)}>
          {t('ui.previous')}
        </Button>
        <Button variant="secondary" disabled={!hasNext} onClick={() => onPageChange(page + 1)}>
          {t('ui.next')}
        </Button>
      </div>
    </div>
  )
}
