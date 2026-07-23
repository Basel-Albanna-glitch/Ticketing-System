// Columns may be plain strings (non-sortable) or objects { label, sortKey }. When a column
// has a sortKey and an onSort handler is provided, its header becomes a sort toggle.
export default function Table({ columns, sortBy, sortDir, onSort, children }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-200/70 bg-white shadow-soft dark:border-white/10 dark:bg-gray-900/70 [&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-gray-50 dark:[&_tbody_tr:hover]:bg-white/5">
      <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-white/10">
        <thead className="bg-gray-50/80 dark:bg-white/5">
          <tr>
            {columns.map((col, i) => {
              const label = typeof col === 'string' ? col : col.label
              const sortKey = typeof col === 'string' ? null : col.sortKey
              const sortable = sortKey && onSort
              const active = sortable && sortBy === sortKey
              return (
                <th
                  key={i}
                  className="px-4 py-2 text-start text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
                >
                  {sortable ? (
                    <button
                      type="button"
                      onClick={() => onSort(sortKey)}
                      className="inline-flex items-center gap-1 uppercase hover:text-gray-700 dark:hover:text-gray-200"
                    >
                      {label}
                      <span className="text-gray-400 dark:text-gray-500">
                        {active ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}
                      </span>
                    </button>
                  ) : (
                    label
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-white/5">{children}</tbody>
      </table>
    </div>
  )
}
