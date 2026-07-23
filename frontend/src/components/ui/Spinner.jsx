export default function Spinner({ className = '' }) {
  return (
    <div
      className={`h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-600 dark:border-gray-600 dark:border-t-indigo-400 ${className}`}
      role="status"
      aria-label="Loading"
    />
  )
}
