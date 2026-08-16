import { useCallback, useRef, useState } from 'react'
import Input from '../ui/Input'
import Select from '../ui/Select'
import { useAuth } from '../../auth/useAuth'
import useDismissOnOutsideClick from '../../hooks/useDismissOnOutsideClick'
import { useCategories } from '../../hooks/useCategories'
import { useI18n } from '../../i18n/useI18n'

const STATUS_OPTIONS = [
  { value: 'open', labelKey: 'status.open' },
  { value: 'in_progress', labelKey: 'status.in_progress' },
  { value: 'on_hold', labelKey: 'status.on_hold' },
  { value: 'resolved', labelKey: 'status.resolved' },
  { value: 'closed', labelKey: 'status.closed' },
]

function StatusDropdown({ selected, onToggle, onClear }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useDismissOnOutsideClick(ref, useCallback(() => setOpen(false), []), open)

  const selectedOption = STATUS_OPTIONS.find((o) => o.value === selected[0])
  const summary =
    selected.length === 0
      ? t('tickets.allStatuses')
      : selected.length === 1
        ? selectedOption && t(selectedOption.labelKey)
        : `${selected.length}${t('tickets.selectedSuffix')}`

  return (
    <div className="flex flex-col gap-1" ref={ref}>
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('field.status')}</span>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex w-48 items-center justify-between rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 dark:border-white/10 dark:bg-white/5 dark:text-gray-100"
        >
          <span className={selected.length ? '' : 'text-gray-400 dark:text-gray-400'}>{summary}</span>
          <span className="ms-2 text-gray-400 dark:text-gray-400">▾</span>
        </button>
        {open && (
          <div className="absolute z-50 mt-1 w-48 overflow-hidden rounded-xl border border-gray-200/70 bg-white shadow-soft-lg dark:border-white/10 dark:bg-gray-900">
            <div className="max-h-60 overflow-y-auto py-1">
              {STATUS_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-white/5"
                >
                  <input
                    type="checkbox"
                    className="accent-indigo-600"
                    checked={selected.includes(opt.value)}
                    onChange={() => onToggle(opt.value)}
                  />
                  {t(opt.labelKey)}
                </label>
              ))}
            </div>
            {selected.length > 0 && (
              <button
                type="button"
                onClick={onClear}
                className="w-full border-t border-gray-100 px-3 py-1.5 text-start text-xs text-gray-500 hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/5"
              >
                {t('tickets.clear')}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function TicketFilters({ filters, onChange }) {
  const { t } = useI18n()
  const { user } = useAuth()
  const { data: categories } = useCategories()

  function set(key, value) {
    onChange({ ...filters, [key]: value, page: 1 })
  }

  const selectedStatuses = (filters.status || '').split(',').filter(Boolean)

  function toggleStatus(value) {
    const next = selectedStatuses.includes(value)
      ? selectedStatuses.filter((s) => s !== value)
      : [...selectedStatuses, value]
    set('status', next.join(','))
  }

  return (
    <div className="mb-4 flex flex-wrap items-end gap-4">
      <Input
        label={t('common.search')}
        placeholder={
          user?.role === 'customer'
            ? t('tickets.searchBySubject')
            : t('tickets.searchSubjectOrCustomer')
        }
        value={filters.search || ''}
        onChange={(e) => set('search', e.target.value)}
      />
      <StatusDropdown
        selected={selectedStatuses}
        onToggle={toggleStatus}
        onClear={() => set('status', '')}
      />
      <Select label={t('field.priority')} value={filters.priority || ''} onChange={(e) => set('priority', e.target.value)}>
        <option value="">{t('common.all')}</option>
        <option value="low">{t('priority.low')}</option>
        <option value="medium">{t('priority.medium')}</option>
        <option value="high">{t('priority.high')}</option>
        <option value="urgent">{t('priority.urgent')}</option>
      </Select>
      <Select label={t('field.category')} value={filters.category || ''} onChange={(e) => set('category', e.target.value)}>
        <option value="">{t('common.all')}</option>
        {(categories || [])
          .filter((c) => c.parent == null)
          .map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
      </Select>
    </div>
  )
}
