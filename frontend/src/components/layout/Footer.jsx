import { useI18n } from '../../i18n/useI18n'

export default function Footer() {
  const { t } = useI18n()
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-gray-200/70 px-6 py-4 text-center text-xs text-gray-400 dark:border-white/10 dark:text-gray-500">
      © {year} Hermes · {t('footer.rights')}
    </footer>
  )
}
