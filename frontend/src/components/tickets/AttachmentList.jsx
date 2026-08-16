import { useState } from 'react'
import { PaperClipIcon } from '../ui/icons'
import ImageLightbox from '../ui/ImageLightbox'
import { isImageAttachment } from '../../utils/attachments'
import { useI18n } from '../../i18n/useI18n'

export default function AttachmentList({ attachments }) {
  const { t } = useI18n()
  // An image that fails to load falls back to the plain file chip.
  const [broken, setBroken] = useState([])
  const [lightboxIndex, setLightboxIndex] = useState(null)

  if (!attachments?.length) {
    return <p className="text-sm text-gray-400 dark:text-gray-400">{t('tickets.noAttachments')}</p>
  }

  const images = attachments.filter((a) => isImageAttachment(a) && !broken.includes(a.id))
  const files = attachments.filter((a) => !images.includes(a))

  return (
    <div className="flex flex-col gap-2">
      {images.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {images.map((a, i) => (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => setLightboxIndex(i)}
                title={a.original_filename}
                className="block h-20 w-20 overflow-hidden rounded-xl border border-gray-200/70 bg-gray-50 transition-all hover:border-indigo-300 hover:shadow-md dark:border-white/10 dark:bg-white/5 dark:hover:border-indigo-400/40"
              >
                <img
                  src={a.file}
                  alt={a.original_filename}
                  loading="lazy"
                  onError={() => setBroken((current) => [...current, a.id])}
                  className="h-full w-full object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      )}

      {files.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {files.map((a) => (
            <li key={a.id}>
              <a
                href={a.file}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200/70 bg-white px-2.5 py-1.5 text-sm text-gray-700 transition-colors hover:border-indigo-300 hover:text-indigo-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:border-indigo-400/40 dark:hover:text-indigo-300"
              >
                <PaperClipIcon className="h-3.5 w-3.5 text-gray-400 dark:text-gray-400" />
                {a.original_filename}
              </a>
            </li>
          ))}
        </ul>
      )}

      {lightboxIndex !== null && (
        <ImageLightbox
          images={images}
          index={lightboxIndex}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  )
}
