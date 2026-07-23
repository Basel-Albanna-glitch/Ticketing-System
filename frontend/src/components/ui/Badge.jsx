// Solid (filled) badge palette.
const SOLID = {
  gray: 'bg-gray-100 text-gray-700 ring-gray-500/15 dark:bg-gray-700/40 dark:text-gray-300 dark:ring-white/10',
  blue: 'bg-blue-100 text-blue-700 ring-blue-500/20 dark:bg-blue-900/40 dark:text-blue-300 dark:ring-blue-400/20',
  amber: 'bg-amber-100 text-amber-700 ring-amber-500/20 dark:bg-amber-900/40 dark:text-amber-300 dark:ring-amber-400/20',
  green: 'bg-green-100 text-green-700 ring-green-500/20 dark:bg-green-900/40 dark:text-green-300 dark:ring-green-400/20',
  red: 'bg-red-100 text-red-700 ring-red-500/20 dark:bg-red-900/40 dark:text-red-300 dark:ring-red-400/20',
  orange: 'bg-orange-100 text-orange-700 ring-orange-500/20 dark:bg-orange-900/40 dark:text-orange-300 dark:ring-orange-400/20',
  purple: 'bg-purple-100 text-purple-700 ring-purple-500/20 dark:bg-purple-900/40 dark:text-purple-300 dark:ring-purple-400/20',
}

// Outline (border-only, transparent fill) palette — same hues, different design.
const OUTLINE = {
  gray: 'text-gray-600 ring-gray-300 dark:text-gray-300 dark:ring-white/25',
  blue: 'text-blue-700 ring-blue-400 dark:text-blue-300 dark:ring-blue-400/50',
  amber: 'text-amber-700 ring-amber-400 dark:text-amber-300 dark:ring-amber-400/50',
  green: 'text-green-700 ring-green-400 dark:text-green-300 dark:ring-green-400/50',
  red: 'text-red-700 ring-red-400 dark:text-red-300 dark:ring-red-400/50',
  orange: 'text-orange-700 ring-orange-400 dark:text-orange-300 dark:ring-orange-400/50',
  purple: 'text-purple-700 ring-purple-400 dark:text-purple-300 dark:ring-purple-400/50',
}

export default function Badge({ color = 'gray', variant = 'solid', children }) {
  const palette = variant === 'outline' ? OUTLINE : SOLID
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${palette[color] || palette.gray}`}
    >
      {children}
    </span>
  )
}
