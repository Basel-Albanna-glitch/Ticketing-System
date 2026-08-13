import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Avatar from '../ui/Avatar'
import Logo from '../ui/Logo'
import ThemeToggle from '../ui/ThemeToggle'
import LanguageToggle from '../ui/LanguageToggle'
import NotificationBell from './NotificationBell'
import { LogoutIcon, MenuIcon, SettingsIcon, UserIcon } from '../ui/icons'
import { useAuth } from '../../auth/useAuth'
import useDismissOnOutsideClick from '../../hooks/useDismissOnOutsideClick'
import { useI18n } from '../../i18n/useI18n'

const MENU_ITEM =
  'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/5'

// Avatar + name button that opens the account menu. Replaces the plain name text that used
// to sit here, and gives logout a home outside the collapsible sidebar.
function UserMenu() {
  const { t } = useI18n()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useDismissOnOutsideClick(ref, useCallback(() => setOpen(false), []), open)

  useEffect(() => {
    function onEscape(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onEscape)
    return () => document.removeEventListener('keydown', onEscape)
  }, [])

  function go(to) {
    setOpen(false)
    navigate(to)
  }

  function handleLogout() {
    setOpen(false)
    logout()
    navigate('/login')
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`flex items-center gap-2 rounded-xl p-1 ps-1 transition-colors sm:ps-3 ${
          open
            ? 'bg-gray-100 dark:bg-white/10'
            : 'hover:bg-gray-100 dark:hover:bg-white/10'
        }`}
      >
        <span className="hidden text-start sm:block">
          <span className="block max-w-40 truncate text-sm font-medium leading-tight text-gray-700 dark:text-gray-200">
            {user?.full_name}
          </span>
          <span className="block text-xs capitalize leading-tight text-gray-400 dark:text-gray-500">
            {t(`role.${user?.role}`)}
          </span>
        </span>
        <Avatar name={user?.full_name} src={user?.avatar} size="md" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute end-0 z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-gray-200/70 bg-white shadow-soft-lg dark:border-white/10 dark:bg-gray-900"
        >
          <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3 dark:border-white/10">
            <Avatar name={user?.full_name} src={user?.avatar} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                {user?.full_name}
              </p>
              <p className="truncate text-xs text-gray-400 dark:text-gray-500">@{user?.username}</p>
              <span className="mt-1 inline-flex rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium capitalize text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
                {t(`role.${user?.role}`)}
              </span>
            </div>
          </div>
          <div className="p-1.5">
            {user?.role === 'customer' && (
              <button type="button" role="menuitem" onClick={() => go('/account')} className={MENU_ITEM}>
                <UserIcon className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                {t('nav.account')}
              </button>
            )}
            <button type="button" role="menuitem" onClick={() => go('/settings')} className={MENU_ITEM}>
              <SettingsIcon className="h-4 w-4 text-gray-400 dark:text-gray-500" />
              {t('nav.settings')}
            </button>
          </div>
          <div className="border-t border-gray-100 p-1.5 dark:border-white/10">
            <button
              type="button"
              role="menuitem"
              onClick={handleLogout}
              className={`${MENU_ITEM} text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10`}
            >
              <LogoutIcon className="h-4 w-4" />
              {t('topbar.logout')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Topbar({ onToggleSidebar, sidebarOpen = false }) {
  const { t } = useI18n()

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-gray-200/70 bg-white/70 px-4 py-2.5 backdrop-blur-xl sm:px-6 dark:border-white/10 dark:bg-gray-900/60">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label={t('topbar.toggleSidebar')}
          aria-expanded={sidebarOpen}
          className="rounded-xl p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-gray-200"
        >
          <MenuIcon className="h-5 w-5" />
        </button>
        {/* The sidebar carries the wordmark when it's open; stand in for it when it isn't,
            so the brand never disappears entirely. */}
        {!sidebarOpen && (
          <Link to="/dashboard" aria-label="Hermes" className="ms-1 shrink-0">
            <Logo />
          </Link>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        {/* The three global controls read as one unit rather than three loose icons. */}
        <div className="flex items-center gap-0.5 rounded-xl bg-gray-50/80 p-0.5 ring-1 ring-inset ring-gray-200/70 dark:bg-white/5 dark:ring-white/10">
          <NotificationBell />
          <LanguageToggle />
          <ThemeToggle />
        </div>
        <span className="mx-1 hidden h-6 w-px bg-gray-200 sm:block dark:bg-white/10" />
        <UserMenu />
      </div>
    </header>
  )
}
