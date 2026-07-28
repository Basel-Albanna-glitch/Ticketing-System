import { useI18n } from '../../i18n/useI18n'

export default function LanguageToggle() {
  const { toggleLang, t } = useI18n()

  return (
    <button
      type="button"
      onClick={toggleLang}
      aria-label="Switch language"
      className="inline-flex items-center gap-1.5 rounded-lg px-2 py-2 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-gray-200"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c2.5 2.5 3.5 6 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-6-3.5-9s1-6.5 3.5-9z" />
      </svg>
      <span>{t('lang.switchTo')}</span>
    </button>
  )
}
