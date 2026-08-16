// A row of mutually exclusive choices, sharing one recessed track. Use it where a
// Select would hide the alternatives behind a click and the options are few enough to
// show at once — a view switch, not a form field.
//
// Each option is {value, label, icon?}. `iconOnly` keeps the labels for screen readers
// and tooltips but shows just the glyphs, for a control that sits beside a page title
// and should not compete with it.
//
// Radio semantics rather than a set of buttons: a screen reader should hear "2 of 3
// selected", not three unrelated controls that happen to sit together.
export default function SegmentedControl({
  value,
  onChange,
  options,
  iconOnly = false,
  'aria-label': ariaLabel,
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="inline-flex items-center gap-0.5 rounded-xl bg-gray-100 p-0.5 dark:bg-white/5"
    >
      {options.map((option) => {
        const active = option.value === value
        const Icon = option.icon
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            // The label is the only text an icon-only button has; without it the
            // control reads as three unnamed radios.
            aria-label={iconOnly ? option.label : undefined}
            title={option.title || option.label}
            onClick={() => onChange(option.value)}
            className={`inline-flex items-center gap-1.5 rounded-[10px] px-2.5 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 ${
              active
                ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-gray-100'
                : 'text-gray-500 hover:text-gray-800 dark:text-gray-300 dark:hover:text-gray-100'
            }`}
          >
            {Icon && <Icon className="h-4 w-4" />}
            {!iconOnly && <span>{option.label}</span>}
          </button>
        )
      })}
    </div>
  )
}
