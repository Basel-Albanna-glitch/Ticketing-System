export default function FileInput({ label, files, onChange, multiple = true }) {
  function handleChange(event) {
    onChange(Array.from(event.target.files || []))
  }

  return (
    <div className="flex flex-col gap-1">
      {label && <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>}
      <input
        type="file"
        multiple={multiple}
        onChange={handleChange}
        className="text-sm text-gray-600 file:me-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100 dark:text-gray-400 dark:file:bg-indigo-500/15 dark:file:text-indigo-300 dark:hover:file:bg-indigo-500/25"
      />
      {files?.length > 0 && (
        <ul className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {files.map((f, i) => (
            <li key={i}>{f.name}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
