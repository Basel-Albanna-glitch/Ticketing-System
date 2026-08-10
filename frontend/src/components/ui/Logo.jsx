import logoUrl from '../../assets/logo.jpeg'

/**
 * The app brand mark.
 *
 * The artwork is a JPEG with a baked-in white background, so it is set on a
 * white rounded tile rather than dropped straight onto the page: on the dark
 * sidebar or the login hero a bare image would read as a stray white rectangle.
 * The tile makes that whiteness look deliberate in every theme.
 *
 * `variant="light"` is for placement on a dark panel, where the tile needs a
 * soft outline instead of the light theme's hairline border.
 */
export default function Logo({ variant = 'dark', className = '' }) {
  return (
    <span
      className={`inline-flex items-center justify-center overflow-hidden rounded-xl bg-white p-1 shadow-sm ring-1 ${
        variant === 'light' ? 'ring-white/25' : 'ring-gray-200/80 dark:ring-white/10'
      } ${className}`}
    >
      <img
        src={logoUrl}
        alt="Hermes"
        // The wordmark is part of the artwork, so the alt text carries the name
        // and no separate text label is needed beside it.
        className="h-9 w-9 object-contain"
        width={36}
        height={36}
      />
    </span>
  )
}
