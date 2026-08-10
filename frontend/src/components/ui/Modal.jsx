const SIZES = {
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
}

/**
 * `dismissOnBackdrop` controls whether clicking the dimmed area closes the
 * dialog. Set it to false for anything holding typed-in work: a mis-aimed click
 * next to the box otherwise throws the whole form away with no warning and no
 * way to get it back. The ✕ and any Cancel button still close it, so nobody is
 * ever stuck.
 */
export default function Modal({
  open,
  onClose,
  title,
  children,
  size = 'md',
  dismissOnBackdrop = true,
}) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-4 backdrop-blur-sm"
      onClick={dismissOnBackdrop ? onClose : undefined}
    >
      <div
        className={`flex max-h-[90vh] w-full ${SIZES[size] || SIZES.md} flex-col rounded-2xl border border-gray-200/70 bg-white shadow-soft-lg dark:border-white/10 dark:bg-gray-900`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 dark:border-white/5">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/10 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  )
}
