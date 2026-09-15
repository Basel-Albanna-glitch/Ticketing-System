import { useCallback, useRef, useState } from 'react'
import Button from '../ui/Button'
import { useAuth } from '../../auth/useAuth'
import useDismissOnOutsideClick from '../../hooks/useDismissOnOutsideClick'
import { useI18n } from '../../i18n/useI18n'
import {
  TICKET_COLUMNS,
  allowedTicketColumns,
  canCustomizeTicketColumns,
  visibleTicketColumns,
} from '../../constants/ticketColumns'

// Lets someone hide ticket-table columns for themselves, if their role grants that. Only the
// columns their role allows are listed, so it can never reveal one they were denied. The
// choice is saved to their account, so it follows them between browsers and applies to every
// ticket table they see.
export default function TicketColumnPicker() {
  const { t } = useI18n()
  const { user, updateMe } = useAuth()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const ref = useRef(null)

  useDismissOnOutsideClick(ref, useCallback(() => setOpen(false), []), open)

  if (!canCustomizeTicketColumns(user)) return null

  const allowed = new Set(allowedTicketColumns(user))
  const options = TICKET_COLUMNS.filter((c) => allowed.has(c.key))
  const visible = new Set(visibleTicketColumns(user))
  const hiddenCount = options.length - visible.size

  async function save(hidden) {
    setError('')
    try {
      await updateMe({ hidden_ticket_columns: hidden })
    } catch {
      setError(t('tickets.columnsSaveError'))
    }
  }

  function toggle(key) {
    const hidden = new Set(options.filter((c) => !visible.has(c.key)).map((c) => c.key))
    if (hidden.has(key)) {
      hidden.delete(key)
    } else {
      // The last visible column stays: an empty table is never what anyone meant.
      if (visible.size <= 1) return
      hidden.add(key)
    }
    save([...hidden])
  }

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="secondary"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="whitespace-nowrap"
      >
        {t('tickets.columns')}
        {hiddenCount > 0 && (
          <span className="rounded-full bg-indigo-50 px-1.5 text-xs font-medium text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
            {hiddenCount} {t('tickets.columnsHidden')}
          </span>
        )}
      </Button>
      {open && (
        <div className="absolute end-0 z-50 mt-1 w-64 overflow-hidden rounded-xl border border-gray-200/70 bg-white shadow-soft-lg dark:border-white/10 dark:bg-gray-900">
          <div className="max-h-80 overflow-y-auto py-1">
            {options.map((column) => {
              const checked = visible.has(column.key)
              const locked = checked && visible.size <= 1
              return (
                <button
                  key={column.key}
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={checked}
                  disabled={locked}
                  onClick={() => toggle(column.key)}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-start text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:text-gray-200 dark:hover:bg-white/5"
                >
                  <span
                    aria-hidden
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${
                      checked
                        ? 'border-indigo-500 bg-indigo-500 text-white'
                        : 'border-gray-300 dark:border-white/20'
                    }`}
                  >
                    {checked ? '✓' : ''}
                  </span>
                  <span className="truncate">{t(column.labelKey)}</span>
                </button>
              )
            })}
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-gray-100 px-3 py-2 dark:border-white/10">
            {error ? (
              <span className="text-xs text-red-600 dark:text-red-400">{error}</span>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={() => save([])}
              disabled={hiddenCount === 0}
              className="text-xs font-medium text-indigo-600 hover:underline disabled:cursor-default disabled:text-gray-400 disabled:no-underline dark:text-indigo-400 dark:disabled:text-gray-500"
            >
              {t('tickets.showAllColumns')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
