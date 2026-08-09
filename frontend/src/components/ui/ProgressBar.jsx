// A slim completion meter. `value` and `max` are counts, not percentages — the bar
// does the arithmetic so callers cannot disagree about rounding. A project with no
// tasks reads as 0%, never as complete.
export default function ProgressBar({ value = 0, max = 0, label, className = '' }) {
  const percent = max > 0 ? Math.round((value / max) * 100) : 0
  const complete = max > 0 && value >= max

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500 dark:text-gray-400">{label}</span>
          <span className={`font-medium tabular-nums ${complete ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-600 dark:text-gray-300'}`}>
            {percent}%
          </span>
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/10"
      >
        <div
          // Width is the only inline style: it is data, not design.
          style={{ width: `${percent}%` }}
          className={`h-full rounded-full transition-[width] duration-500 ${
            complete ? 'bg-emerald-500' : 'bg-indigo-500'
          }`}
        />
      </div>
    </div>
  )
}
