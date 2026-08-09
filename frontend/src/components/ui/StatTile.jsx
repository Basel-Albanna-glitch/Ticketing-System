const COLORS = {
  indigo: {
    surface: 'from-indigo-50 to-white ring-indigo-200/60 dark:from-indigo-500/10 dark:to-transparent dark:ring-indigo-400/15',
    chip: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300',
  },
  blue: {
    surface: 'from-blue-50 to-white ring-blue-200/60 dark:from-blue-500/10 dark:to-transparent dark:ring-blue-400/15',
    chip: 'bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300',
  },
  amber: {
    surface: 'from-amber-50 to-white ring-amber-200/60 dark:from-amber-500/10 dark:to-transparent dark:ring-amber-400/15',
    chip: 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300',
  },
  green: {
    surface: 'from-emerald-50 to-white ring-emerald-200/60 dark:from-emerald-500/10 dark:to-transparent dark:ring-emerald-400/15',
    chip: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
  },
  purple: {
    surface: 'from-purple-50 to-white ring-purple-200/60 dark:from-purple-500/10 dark:to-transparent dark:ring-purple-400/15',
    chip: 'bg-purple-100 text-purple-600 dark:bg-purple-500/15 dark:text-purple-300',
  },
  red: {
    surface: 'from-red-50 to-white ring-red-200/60 dark:from-red-500/10 dark:to-transparent dark:ring-red-400/15',
    chip: 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-300',
  },
}

export default function StatTile({ label, value, hint, icon: IconComponent, color = 'indigo' }) {
  const c = COLORS[color] || COLORS.indigo
  return (
    <div
      className={`flex items-center gap-4 rounded-2xl border border-transparent bg-gradient-to-br p-6 shadow-soft ring-1 ring-inset ${c.surface}`}
    >
      {IconComponent && (
        <div className={`rounded-xl p-2.5 ${c.chip}`}>
          <IconComponent className="h-5 w-5" />
        </div>
      )}
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</span>
        <span className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
          {value}
        </span>
        {hint && <span className="text-xs text-gray-400 dark:text-gray-500">{hint}</span>}
      </div>
    </div>
  )
}
