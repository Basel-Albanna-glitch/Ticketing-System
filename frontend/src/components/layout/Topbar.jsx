import { useNavigate } from 'react-router-dom'
import Button from '../ui/Button'
import ThemeToggle from '../ui/ThemeToggle'
import LanguageToggle from '../ui/LanguageToggle'
import NotificationBell from './NotificationBell'
import { LogoutIcon, MenuIcon } from '../ui/icons'
import { useAuth } from '../../auth/useAuth'
import { useI18n } from '../../i18n/useI18n'

export default function Topbar({ onToggleSidebar }) {
  const { user, logout } = useAuth()
  const { t } = useI18n()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-gray-200/70 bg-white/70 px-6 py-3 backdrop-blur-xl dark:border-white/10 dark:bg-gray-900/60">
      <button
        type="button"
        onClick={onToggleSidebar}
        aria-label={t('topbar.toggleSidebar')}
        className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-gray-200"
      >
        <MenuIcon className="h-5 w-5" />
      </button>
      <div className="flex items-center gap-3">
        <NotificationBell />
        <LanguageToggle />
        <ThemeToggle />
        <span className="hidden text-sm text-gray-600 sm:inline dark:text-gray-300">
          {user?.full_name}{' '}
          <span className="text-gray-400 dark:text-gray-500">({t(`role.${user?.role}`)})</span>
        </span>
        <Button variant="ghost" onClick={handleLogout}>
          <LogoutIcon className="h-4 w-4" />
          {t('topbar.logout')}
        </Button>
      </div>
    </header>
  )
}
