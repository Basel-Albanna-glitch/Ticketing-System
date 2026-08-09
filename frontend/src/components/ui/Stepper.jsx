// A horizontal stage picker. `steps` is an array of { value, label }; `value` is the
// current stage and `onChange` receives the clicked one. Every stage is clickable, not
// just the next: work slips backwards as often as it moves forward.
export default function Stepper({ steps = [], value, onChange, label, disabled = false }) {
  const currentIndex = steps.findIndex((s) => s.value === value)

  return (
    <div className="flex flex-col gap-2">
      {label && <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>}
      <div className="flex items-start">
        {steps.map((step, index) => {
          const done = index < currentIndex
          const current = index === currentIndex
          return (
            <div key={step.value} className="flex flex-1 flex-col items-center">
              <div className="flex w-full items-center">
                {/* Connector to the left, drawn filled once the stage is reached. */}
                <span
                  className={`h-0.5 flex-1 ${index === 0 ? 'invisible' : ''} ${
                    done || current ? 'bg-indigo-500' : 'bg-gray-200 dark:bg-white/10'
                  }`}
                />
                <button
                  type="button"
                  disabled={disabled}
                  aria-current={current ? 'step' : undefined}
                  onClick={() => onChange(step.value)}
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed ${
                    current
                      ? 'border-indigo-500 bg-indigo-500 text-white'
                      : done
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300'
                        : 'border-gray-300 bg-white text-gray-400 hover:border-indigo-400 hover:text-indigo-500 dark:border-white/15 dark:bg-gray-900 dark:text-gray-500'
                  }`}
                >
                  {done ? '✓' : index + 1}
                </button>
                <span
                  className={`h-0.5 flex-1 ${index === steps.length - 1 ? 'invisible' : ''} ${
                    done ? 'bg-indigo-500' : 'bg-gray-200 dark:bg-white/10'
                  }`}
                />
              </div>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(step.value)}
                className={`mt-1.5 px-1 text-center text-[11px] leading-tight transition-colors ${
                  current
                    ? 'font-semibold text-indigo-600 dark:text-indigo-400'
                    : 'text-gray-500 hover:text-indigo-500 dark:text-gray-400'
                }`}
              >
                {step.label}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
