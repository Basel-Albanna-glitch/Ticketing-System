const SIZES = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-lg',
  xl: 'h-20 w-20 text-2xl',
}

function initials(name = '') {
  return (
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase() || '?'
  )
}

// `src` is the user's uploaded picture; without one the initials stand in, so callers can
// pass `src` unconditionally.
export default function Avatar({ name, src, size = 'sm', className = '' }) {
  const base = `flex shrink-0 items-center justify-center overflow-hidden rounded-full ${SIZES[size]} ${className}`

  if (src) {
    return (
      <img
        src={src}
        alt={name || ''}
        loading="lazy"
        className={`${base} bg-gray-100 object-cover dark:bg-white/10`}
      />
    )
  }

  return (
    <span
      className={`${base} bg-indigo-100 font-semibold text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300`}
    >
      {initials(name)}
    </span>
  )
}
