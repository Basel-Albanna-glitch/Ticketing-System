import { useState } from 'react'
import { EyeIcon, EyeOffIcon } from './icons'

export default function Input({ label, error, className = '', id, icon: IconComponent, type = 'text', ...props }) {
  const inputId = id || props.name
  const isPassword = type === 'password'
  const [reveal, setReveal] = useState(false)
  const inputType = isPassword && reveal ? 'text' : type

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
      )}
      <div className="relative">
        {IconComponent && (
          <IconComponent className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
        )}
        <input
          id={inputId}
          type={inputType}
          className={`w-full rounded-xl border bg-white py-2 text-sm text-gray-900 shadow-sm transition placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 disabled:bg-gray-100 disabled:text-gray-500 dark:bg-white/5 dark:text-gray-100 dark:placeholder:text-gray-500 dark:disabled:bg-gray-900 dark:disabled:text-gray-500 ${
            IconComponent ? 'ps-9' : 'ps-3'
          } ${
            isPassword ? 'pe-10' : 'pe-3'
          } ${
            error ? 'border-red-400 dark:border-red-500' : 'border-gray-300 dark:border-white/10'
          } ${className}`}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setReveal((v) => !v)}
            tabIndex={-1}
            aria-label={reveal ? 'Hide password' : 'Show password'}
            aria-pressed={reveal}
            className="absolute end-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-gray-400 transition hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 dark:text-gray-500 dark:hover:text-gray-300"
          >
            {reveal ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}
