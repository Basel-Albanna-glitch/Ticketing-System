export default function SectionHeader({ icon: Icon, title, description, action, className = '' }) {
  return (
    <div
      className={`mb-5 flex items-start gap-3 border-b border-gray-100 pb-4 dark:border-white/10 ${className}`}
    >
      {Icon && (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
          <Icon className="h-5 w-5" />
        </span>
      )}
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
        {description && (
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-300">{description}</p>
        )}
      </div>
      {action && <div className="ms-auto shrink-0 self-center">{action}</div>}
    </div>
  )
}
