// Text wordmark used as the app brand.
export default function Logo({ variant = 'dark', className = '' }) {
  return (
    <span
      className={`text-lg font-semibold ${
        variant === 'light' ? 'text-white' : 'text-gray-900 dark:text-gray-100'
      } ${className}`}
    >
      Hermes
    </span>
  )
}
