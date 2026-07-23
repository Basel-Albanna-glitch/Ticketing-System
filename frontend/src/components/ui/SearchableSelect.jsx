import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../../i18n/useI18n'

// A single-select dropdown with a built-in search box. `options` is an array of
// { value, label }. `onChange` receives the selected value (as a string).
export default function SearchableSelect({
  label,
  value,
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

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  useEffect(() => {
    if (open) inputRef.current?.focus()
    else setQuery('')
  }, [open])

  const selected = options.find((o) => String(o.value) === String(value))
  const q = query.trim().toLowerCase()
  const filtered = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options

  function select(val) {
    onChange(val)
    setOpen(false)
  }

  return (
    <div className="flex flex-col gap-1" ref={ref}>
      {label && (
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
      )}
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 disabled:bg-gray-100 disabled:text-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-gray-100 dark:disabled:bg-gray-900"
        >
          <span className={`truncate ${selected ? '' : 'text-gray-400 dark:text-gray-500'}`}>
            {selected ? selected.label : placeholder || t('common.select')}
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
                    onClick={() => select(o.value)}
                    className={`block w-full truncate px-3 py-1.5 text-start text-sm hover:bg-gray-50 dark:hover:bg-white/5 ${
                      String(o.value) === String(value)
                        ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300'
                        : 'text-gray-700 dark:text-gray-200'
                    }`}
                  >
                    {o.label}
                  </button>
                ))
              ) : (
                <p className="px-3 py-2 text-xs text-gray-400 dark:text-gray-500">
                  {t('common.noResults')}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
