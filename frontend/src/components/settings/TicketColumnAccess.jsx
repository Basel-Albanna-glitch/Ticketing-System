import { TICKET_COLUMNS } from '../../constants/ticketColumns'
import { useI18n } from '../../i18n/useI18n'

// Ticks the ticket-table columns a role — or agents without one — may see. Stored the other
// way round, as the columns withheld, so a column added later is visible by default instead
// of silently missing for every existing role. At least one stays ticked; the backend
// refuses a table with nothing left in it.
export default function TicketColumnAccess({ withheld = [], onChange, hint }) {
  const { t } = useI18n()
  const hidden = new Set(withheld)
  const visibleCount = TICKET_COLUMNS.filter((c) => !hidden.has(c.key)).length

  function toggle(key) {
    if (hidden.has(key)) onChange(withheld.filter((k) => k !== key))
    else onChange([...withheld, key])
  }

  return (
    <div className="flex flex-col gap-2">
      {hint && <p className="text-xs text-gray-400 dark:text-gray-400">{hint}</p>}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {TICKET_COLUMNS.map((column) => {
          const checked = !hidden.has(column.key)
          const locked = checked && visibleCount <= 1
          return (
            <label
              key={column.key}
              className={`flex items-center gap-2.5 rounded-xl border border-gray-200/70 px-3 py-2 text-sm text-gray-700 dark:border-white/10 dark:text-gray-300 ${
                locked ? 'opacity-60' : 'cursor-pointer'
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={locked}
                onChange={() => toggle(column.key)}
                className="h-4 w-4 shrink-0 rounded border-gray-300 accent-indigo-600"
              />
              {t(column.labelKey)}
            </label>
          )
        })}
      </div>
    </div>
  )
}
