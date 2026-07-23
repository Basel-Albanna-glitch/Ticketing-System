export default function Select({ label, error, className = '', id, children, ...props }) {
  const selectId = id || props.name

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={selectId} className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={`rounded-xl border bg-white px-3 py-2 text-sm text-gray-900 shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 dark:bg-gray-800 dark:text-gray-100 dark:[&_option]:bg-gray-800 dark:[&_option]:text-gray-100 ${
          error ? 'border-red-400 dark:border-red-500' : 'border-gray-300 dark:border-white/10'
        } ${className}`}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}
