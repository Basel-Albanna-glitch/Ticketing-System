import { useCallback, useEffect, useRef, useState } from 'react'
import useDismissOnOutsideClick from '../../hooks/useDismissOnOutsideClick'
import { useI18n } from '../../i18n/useI18n'

// A multi-select with a search box, built to mirror SearchableSelect. `options` is an
// array of { value, label }; `value` is an array of selected values and `onChange`
// receives the new array. Picks show as removable chips above the control.
export default function MultiSelect({
  label,
  value = [],
  onChange,
  options = [],
  placeholder,
  disabled = false,
}) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef(null)
  const inputRef = useRef(null)

  useDismissOnOutsideClick(ref, useCallback(() => setOpen(false), []), open)

  useEffect(() => {
    if (open) inputRef.current?.focus()
    else setQuery('')
  }, [open])

  // Compare as strings: selections arriving from an API are numbers, while values
  // that have been through a DOM attribute come back as strings.
  const isSelected = (val) => value.some((v) => String(v) === String(val))
  const selected = options.filter((o) => isSelected(o.value))
  const q = query.trim().toLowerCase()
  const filtered = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options

  function toggle(val) {
    if (isSelected(val)) onChange(value.filter((v) => String(v) !== String(val)))
    else onChange([...value, val])
    // The menu stays open: picking several people in a row is the point.
  }

  return (
    <div className="flex flex-col gap-1" ref={ref}>
      {label && <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pb-1">
          {selected.map((o) => (
            <span
              key={o.value}
              className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-600/15 dark:bg-indigo-500/10 dark:text-indigo-300 dark:ring-indigo-400/20"
            >
              {o.label}
              <button
                type="button"
                disabled={disabled}
                onClick={() => toggle(o.value)}
                aria-label={`${t('common.remove')} ${o.label}`}
                className="text-indigo-400 transition-colors hover:text-indigo-700 dark:hover:text-indigo-200"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 disabled:bg-gray-100 disabled:text-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-gray-100 dark:disabled:bg-gray-900"
        >
          <span className={selected.length ? '' : 'text-gray-400 dark:text-gray-500'}>
            {selected.length ? `${selected.length} ${t('common.selected')}` : placeholder || t('common.select')}
          </span>
          <span className="ms-2 shrink-0 text-gray-400 dark:text-gray-500">▾</span>
        </button>
        {open && (
          <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-gray-200/70 bg-white shadow-soft-lg dark:border-white/10 dark:bg-gray-900">
            <div className="border-b border-gray-100 p-2 dark:border-white/10">
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('common.search')}
                className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/15 dark:border-white/10 dark:bg-white/5 dark:text-gray-100"
              />
            </div>
            <div className="max-h-56 overflow-y-auto py-1">
              {filtered.length ? (
                filtered.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => toggle(o.value)}
                    className={`flex w-full items-center gap-2 px-3 py-1.5 text-start text-sm hover:bg-gray-50 dark:hover:bg-white/5 ${
                      isSelected(o.value)
                        ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300'
                        : 'text-gray-700 dark:text-gray-200'
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${
                        isSelected(o.value)
                          ? 'border-indigo-500 bg-indigo-500 text-white'
                          : 'border-gray-300 dark:border-white/20'
                      }`}
                    >
                      {isSelected(o.value) ? '✓' : ''}
                    </span>
                    <span className="truncate">{o.label}</span>
                  </button>
                ))
              ) : (
                <p className="px-3 py-2 text-xs text-gray-400 dark:text-gray-500">{t('common.noResults')}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
