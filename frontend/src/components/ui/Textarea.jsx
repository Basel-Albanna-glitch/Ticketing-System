export default function Textarea({ label, error, className = '', id, ...props }) {
  const textareaId = id || props.name

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={textareaId} className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
      )}
      <textarea
        id={textareaId}
        className={`rounded-xl border bg-white px-3 py-2 text-sm text-gray-900 shadow-sm transition placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 dark:bg-white/5 dark:text-gray-100 dark:placeholder:text-gray-500 ${
          error ? 'border-red-400 dark:border-red-500' : 'border-gray-300 dark:border-white/10'
        } ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}
