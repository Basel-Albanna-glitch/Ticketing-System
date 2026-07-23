import { Link } from 'react-router-dom'

// items: [{ label, to? }] — earlier items link, the last item is the current page.
export default function Breadcrumbs({ items = [] }) {
  return (
    <nav className="mb-4 flex flex-wrap items-center gap-1.5 text-sm" aria-label="Breadcrumb">
      {items.map((item, i) => {
        const isLast = i === items.length - 1
        return (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-gray-300 dark:text-gray-600">/</span>}
            {item.to && !isLast ? (
              <Link
                to={item.to}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                {item.label}
              </Link>
            ) : (
              <span
                className={
                  isLast
                    ? 'font-medium text-gray-700 dark:text-gray-200'
                    : 'text-gray-500 dark:text-gray-400'
                }
              >
                {item.label}
              </span>
            )}
          </span>
        )
      })}
    </nav>
  )
}
