const VARIANTS = {
  primary:
    'bg-gradient-to-b from-indigo-500 to-indigo-600 text-white shadow-sm ring-1 ring-inset ring-indigo-700/20 ' +
    'hover:from-indigo-500 hover:to-indigo-700 hover:shadow-md disabled:from-indigo-300 disabled:to-indigo-300 ' +
    'dark:disabled:from-indigo-900 dark:disabled:to-indigo-900',
  secondary:
    'bg-white text-gray-700 ring-1 ring-inset ring-gray-300 shadow-sm hover:bg-gray-50 hover:ring-gray-400 disabled:text-gray-400 ' +
    'dark:bg-white/5 dark:text-gray-200 dark:ring-white/10 dark:hover:bg-white/10 dark:disabled:text-gray-500',
  danger:
    'bg-gradient-to-b from-red-500 to-red-600 text-white shadow-sm ring-1 ring-inset ring-red-700/20 ' +
    'hover:from-red-500 hover:to-red-700 hover:shadow-md disabled:from-red-300 disabled:to-red-300 dark:disabled:from-red-900 dark:disabled:to-red-900',
  ghost:
    'text-gray-600 hover:bg-gray-100 disabled:text-gray-300 ' +
    'dark:text-gray-300 dark:hover:bg-white/10 dark:disabled:text-gray-600',
}

export default function Button({
  variant = 'primary',
  className = '',
  disabled,
  loading,
  children,
  ...props
}) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all duration-150 active:translate-y-px disabled:cursor-not-allowed disabled:shadow-none disabled:active:translate-y-0 ${VARIANTS[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? 'Loading...' : children}
    </button>
  )
}
