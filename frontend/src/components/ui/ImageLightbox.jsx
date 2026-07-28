import { useEffect } from 'react'
import { ChevronRightIcon } from './icons'
import { useI18n } from '../../i18n/useI18n'

const ARROW = 'absolute top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white backdrop-blur transition-colors hover:bg-white/20'

// Full-screen viewer for image attachments. Arrows and positions are physical (left = back)
// so they keep matching the keyboard in RTL.
export default function ImageLightbox({ images, index, onIndexChange, onClose }) {
  const { t } = useI18n()
  const image = images[index]
  const count = images.length

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') onIndexChange((index - 1 + count) % count)
      if (e.key === 'ArrowRight') onIndexChange((index + 1) % count)
    }
    document.addEventListener('keydown', onKeyDown)
    // Keep the page behind from scrolling while the viewer is up.
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [index, count, onIndexChange, onClose])

  if (!image) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-gray-950/90 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={image.original_filename}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 text-white">
        <span className="min-w-0 truncate text-sm">
          {image.original_filename}
          {count > 1 && (
            <span className="ms-2 text-white/50">
              {index + 1}/{count}
            </span>
          )}
        </span>
        <div className="flex shrink-0 items-center gap-1">
          <a
            href={image.file}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="rounded-lg px-2.5 py-1.5 text-sm text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          >
            {t('attachments.openOriginal')}
          </a>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="rounded-lg px-3 py-1.5 text-lg leading-none text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          >
            ×
          </button>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center p-4 pt-0">
        <img
          src={image.file}
          alt={image.original_filename}
          onClick={(e) => e.stopPropagation()}
          className="max-h-full max-w-full rounded-xl object-contain shadow-2xl"
        />
        {count > 1 && (
          <>
            <button
              type="button"
              aria-label={t('attachments.previous')}
              onClick={(e) => {
                e.stopPropagation()
                onIndexChange((index - 1 + count) % count)
              }}
              className={`${ARROW} left-3`}
            >
              <ChevronRightIcon className="h-5 w-5 rotate-180" />
            </button>
            <button
              type="button"
              aria-label={t('attachments.next')}
              onClick={(e) => {
                e.stopPropagation()
                onIndexChange((index + 1) % count)
              }}
              className={`${ARROW} right-3`}
            >
              <ChevronRightIcon className="h-5 w-5" />
            </button>
          </>
        )}
      </div>
    </div>
  )
}
